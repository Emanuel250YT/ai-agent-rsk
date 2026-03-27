"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { Loader2, Send, ExternalLink, TrendingUp, X, Wallet } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useConfig } from "wagmi";
import {
  getBalance,
  readContract,
  sendTransaction,
  writeContract,
} from "@wagmi/core";
import { checksumAddress, erc20Abi, isAddress, parseEther } from "viem";
import { findToken, isValidWalletAddress } from "@/lib/utils";
import { BLOCK_EXPLORER_URL } from "@/lib/contants";

interface AutoSaveRule {
  percentage: number;
  active: boolean;
}

interface PendingWATx {
  action: "transfer" | "balance" | "autosave";
  to?: string;
  amount?: number;
  token?: string;
  percentage?: number;
  phone?: string; // WA phone for callback after MetaMask signs
}

export default function Home() {
  const [messages, setMessages] = useState<
    { role: string; content: React.ReactNode; timestamp: Date }[]
  >([
    {
      role: "agent",
      content:
        "¡Hola! Soy BlitzPay ⚡ Tu asistente financiero en Rootstock. Puedo ayudarte a enviar pagos, consultar tu balance o activar ahorro automático. ¿Qué necesitás?",
      timestamp: new Date(),
    },
  ]);

  const { address, isConnected } = useAppKitAccount();
  const config = useConfig();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSave, setAutoSave] = useState<AutoSaveRule | null>(null);
  const [pendingWATx, setPendingWATx] = useState<PendingWATx | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTransfer = async (data: {
    token1: string;
    address: string;
    amount: number;
  }) => {
    console.log("Data:", data);
    try {
      const tokenAddress =
        data.token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(data.token1);

      if (!tokenAddress) throw new Error("Token not found");

      let transactionHash: string;
      if (tokenAddress === "trbtc") {
        transactionHash = await sendTransaction(config, {
          to: data.address as `0x${string}`,
          value: parseEther(data.amount.toString()),
        });
      } else {
        transactionHash = await writeContract(config, {
          abi: erc20Abi,
          address: tokenAddress as `0x${string}`,
          functionName: "transfer",
          args: [data.address as `0x${string}`, BigInt(data.amount)],
        });
      }

      return transactionHash;
    } catch (error) {
      console.error("Transfer failed:", error);
      throw error;
    }
  };

  const handleBalance = async (data: { token1: string; address: string }) => {
    try {
      const tokenAdd =
        data.token1.toLowerCase() === "trbtc"
          ? "trbtc"
          : await findToken(data.token1);

      if (!tokenAdd && data.token1.toLowerCase() !== "trbtc") {
        throw new Error("Token not found");
      }

      const acc = (isAddress(data.address) ? data.address : address) as `0x${string}`;

      if (!acc) throw new Error("No wallet address available");

      let balance;

      if (tokenAdd === "trbtc") {
        const queryBalance = await getBalance(config, {
          address: acc,
        });

        balance = {
          displayValue: Number(queryBalance.value) / 10e18,
          symbol: "tRBTC",
        };
      } else {
        const queryBalance = await readContract(config, {
          abi: erc20Abi,
          address: checksumAddress(tokenAdd as `0x${string}`) as `0x${string}`,
          functionName: "balanceOf",
          args: [acc],
        });
        balance = {
          displayValue: Number(queryBalance) / 10e18,

          symbol: data.token1,
        };
      }

      return balance;
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      throw error;
    }
  };

  const handleAutoSaveActivation = (percentage: number): string => {
    setAutoSave({ percentage, active: true });
    return `✅ Auto-ahorro activado: guardaré el **${percentage}%** de cada ingreso en tu vault DeFi en Rootstock.`;
  };

  const addAgentMessage = (content: React.ReactNode) => ({
    role: "agent",
    content,
    timestamp: new Date(),
  });

  const handleConfirmWATx = async () => {
    if (!pendingWATx) return;
    const tx = { ...pendingWATx };
    setPendingWATx(null);
    const base = [...messages];

    if (tx.action === "balance") {
      const userMsg = { role: "user" as const, content: "Consultar balance", timestamp: new Date() };
      const withUser = [...base, userMsg];
      setMessages(withUser);
      setIsLoading(true);
      try {
        const bal = await handleBalance({ token1: "tRBTC", address: address ?? "" });
        setMessages([
          ...withUser,
          addAgentMessage(
            <div className="space-y-0.5">
              <p className="text-[#6A4E2F]/50 text-xs font-medium">Tu balance actual</p>
              <p className="text-2xl font-black text-[#D29C1D]">
                {bal.displayValue.toFixed(6)}{" "}
                <span className="text-base text-[#6A4E2F]/60 font-semibold">{bal.symbol}</span>
              </p>
            </div>
          ),
        ]);
        if (tx.phone) {
          fetch("/api/webhook/tx-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: tx.phone, action: "balance", balance: bal.displayValue, symbol: bal.symbol }),
          }).catch(() => { });
        }
      } catch (e) {
        setMessages([...withUser, addAgentMessage(`❌ Error: ${e instanceof Error ? e.message : "Error"}`)]);
        if (tx.phone) {
          fetch("/api/webhook/tx-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: tx.phone, action: "balance", error: e instanceof Error ? e.message : "Error" }),
          }).catch(() => { });
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (tx.action === "autosave" && tx.percentage) {
      const msg = handleAutoSaveActivation(tx.percentage);
      setMessages([
        ...base,
        addAgentMessage(
          <div className="markdown-content">
            <ReactMarkdown>{msg}</ReactMarkdown>
          </div>
        ),
      ]);
      if (tx.phone) {
        fetch("/api/webhook/tx-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: tx.phone, action: "autosave", percentage: tx.percentage }),
        }).catch(() => { });
      }
      return;
    }

    if (tx.action === "transfer" && tx.to && tx.amount != null) {
      const userMsg = {
        role: "user" as const,
        content: `Enviar ${tx.amount} ${tx.token ?? "tRBTC"} a ${tx.to}`,
        timestamp: new Date(),
      };
      const withUser = [...base, userMsg];
      setMessages(withUser);
      setIsLoading(true);
      try {
        const hash = await handleTransfer({
          address: tx.to,
          token1: tx.token ?? "tRBTC",
          amount: tx.amount,
        });
        setMessages([
          ...withUser,
          addAgentMessage(
            <a
              href={`${BLOCK_EXPLORER_URL}${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#D29C1D] hover:text-[#6A4E2F] underline font-semibold"
            >
              ✅ Transacción enviada: {`${hash.slice(0, 6)}...${hash.slice(-4)}`}
              <ExternalLink size={14} />
            </a>
          ),
        ]);
        if (tx.phone) {
          fetch("/api/webhook/tx-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: tx.phone,
              action: "transfer",
              txHash: hash,
              amount: tx.amount,
              token: tx.token ?? "tRBTC",
              to: tx.to,
            }),
          }).catch(() => { });
        }
      } catch (e) {
        setMessages([
          ...withUser,
          addAgentMessage(`❌ Error: ${e instanceof Error ? e.message : "Operación fallida"}`),
        ]);
        if (tx.phone) {
          fetch("/api/webhook/tx-callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: tx.phone, action: "transfer", error: e instanceof Error ? e.message : "Operación fallida" }),
          }).catch(() => { });
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input, timestamp: new Date() };
    setInput("");
    setIsLoading(true);

    const newMessages = [...messages, userMessage];

    if (!isConnected) {
      setMessages([
        ...newMessages,
        addAgentMessage("Conectá tu wallet primero para realizar esta acción. 👆"),
      ]);
      setIsLoading(false);
      return;
    }

    setMessages(newMessages);

    try {
      // Extract text-only message history for API
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : "Content not available as string",
      }));

      // Process all requests through the AI endpoint
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          question: input,
          address,
          messageHistory: messageHistory,
        }),
      });

      const data = await response.json();

      console.log("AI response:", data);

      if (data?.functionCall) {
        const functionData = data.functionCall;

        switch (functionData.name) {
          case "transfer":
            if (!isValidWalletAddress(functionData?.arguments?.address)) {
              throw new Error("Dirección de wallet inválida");
            }
            const transactionHash = await handleTransfer(
              functionData.arguments
            );
            setMessages([
              ...newMessages,
              addAgentMessage(
                <a
                  href={`${BLOCK_EXPLORER_URL}${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[#D29C1D] hover:text-[#6A4E2F] underline font-semibold"
                >
                  ✅ Transacción enviada:{" "}
                  {`${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`}
                  <ExternalLink size={14} />
                </a>
              ),
            ]);
            break;

          case "balance":
            const balance = await handleBalance(functionData.arguments);
            setMessages([
              ...newMessages,
              addAgentMessage(
                <div className="space-y-0.5">
                  <p className="text-[#6A4E2F]/50 text-xs font-medium">Tu balance actual</p>
                  <p className="text-2xl font-black text-[#D29C1D]">
                    {balance.displayValue.toFixed(6)}{" "}
                    <span className="text-base text-[#6A4E2F]/60 font-semibold">{balance.symbol}</span>
                  </p>
                </div>
              ),
            ]);
            break;

          case "autosave":
            const pct = functionData.arguments.percentage;
            const confirmMsg = handleAutoSaveActivation(pct);
            setMessages([
              ...newMessages,
              addAgentMessage(
                <div className="markdown-content">
                  <ReactMarkdown>{confirmMsg}</ReactMarkdown>
                </div>
              ),
            ]);
            break;

          default:
            setMessages([
              ...newMessages,
              addAgentMessage(
                <div className="markdown-content">
                  <ReactMarkdown>
                    {data.analysis || "No tengo información para esa consulta."}
                  </ReactMarkdown>
                </div>
              ),
            ]);
        }
      } else {
        setMessages([
          ...newMessages,
          addAgentMessage(
            <div className="markdown-content">
              <ReactMarkdown>
                {data.analysis || "No tengo información para esa consulta."}
              </ReactMarkdown>
            </div>
          ),
        ]);
      }
    } catch (error) {
      setMessages([
        ...newMessages,
        addAgentMessage(
          `❌ Error: ${error instanceof Error ? error.message : "Operación fallida"}`
        ),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Parse WhatsApp deep-link params (?wha=1&action=transfer&...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("wha")) return;
    const action = params.get("action");
    const phone = params.get("phone") ?? undefined;
    window.history.replaceState({}, "", "/");
    if (action === "transfer") {
      const to = params.get("to");
      const amount = params.get("amount");
      const token = params.get("token") ?? "tRBTC";
      if (to && amount) setPendingWATx({ action: "transfer", to, amount: parseFloat(amount), token, phone });
    } else if (action === "balance") {
      setPendingWATx({ action: "balance", phone });
    } else if (action === "autosave") {
      const pct = params.get("percentage");
      if (pct) setPendingWATx({ action: "autosave", percentage: parseFloat(pct), phone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col h-[100dvh] max-w-md mx-auto relative overflow-hidden"
      style={{ fontFamily: "var(--font-nunito, 'Nunito'), system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#6A4E2F] z-10 shadow-[0_2px_16px_rgba(106,78,47,0.3)]">
        <div className="flex items-center gap-3">
          <div className="blitz-logo-ring w-11 h-11 rounded-full overflow-hidden shadow-lg shadow-[#FBDC5C]/30 flex-shrink-0">
            <Image src="/img/blitz-robot.png" width={44} height={44} alt="BlitzPay" className="w-full h-full object-cover" priority />
          </div>
          <div>
            <p className="font-brand font-black text-[#FBF8EE] text-[17px] leading-tight tracking-[-0.01em]">
              BlitzPay
            </p>
            <p className="text-[10px] text-[#DEC691]/80 leading-tight font-medium">
              ● Online&nbsp;·&nbsp;Rootstock Testnet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {address && (
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-[#DEC691] bg-white/10 rounded-full px-2.5 py-1 font-medium border border-[#DEC691]/20">
              <Wallet className="w-3 h-3" />
              {`${address.slice(0, 5)}…${address.slice(-4)}`}
            </span>
          )}
          <ConnectButton />
        </div>
      </div>

      {/* AutoSave Banner */}
      {autoSave?.active && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FBDC5C] border-b border-[#D29C1D]/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6A4E2F] flex-shrink-0" />
            <span className="text-xs text-[#6A4E2F] font-semibold">
              Auto-ahorro activo:{" "}
              <span className="font-black">{autoSave.percentage}%</span> de cada ingreso
            </span>
          </div>
          <button
            onClick={() => setAutoSave(null)}
            className="text-[#6A4E2F]/50 hover:text-[#6A4E2F] transition-colors ml-2"
            aria-label="Cancelar auto-ahorro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div
        className="flex-1 overflow-y-auto px-3.5 py-4 space-y-0.5 blitz-chat-bg"
        ref={containerRef}
      >
        {messages.map(({ role, content, timestamp }, idx) => {
          const isGroupStart = idx === 0 || messages[idx - 1].role !== role;
          return (
            <div
              key={idx}
              className={`flex items-end gap-2 ${role === "user" ? "justify-end msg-user" : "justify-start msg-agent"
                }${isGroupStart && idx > 0 ? " mt-4" : " mt-0.5"}`}
            >
              {role === "agent" ? (
                isGroupStart ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 shadow-md">
                    <Image src="/img/blitz-robot.png" width={28} height={28} alt="BlitzPay" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-7 flex-shrink-0" />
                )
              ) : null}
              <div
                className={`max-w-[80%] px-4 py-2.5 ${role === "user"
                  ? "bg-[#FBDC5C] text-[#3D2310] rounded-[18px] rounded-br-[5px] shadow-[0_2px_10px_rgba(210,156,29,0.22)]"
                  : "bg-white text-[#4A3220] rounded-[18px] rounded-bl-[5px] border border-[#DEC691]/60 shadow-[0_1px_6px_rgba(106,78,47,0.08)]"
                  }`}
              >
                <div className="text-[13.5px] leading-relaxed break-words">
                  {content}
                </div>
                <div
                  className={`text-[10px] mt-1 text-right ${role === "user" ? "text-[#6A4E2F]/50" : "text-[#6A4E2F]/30"
                    }`}
                >
                  {timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-end gap-2 justify-start mt-4">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 shadow-md">
              <Image src="/img/blitz-robot.png" width={28} height={28} alt="BlitzPay" className="w-full h-full object-cover" />
            </div>
            <div className="bg-white rounded-[18px] rounded-bl-[5px] px-5 py-3.5 border border-[#DEC691]/60 shadow-[0_1px_6px_rgba(106,78,47,0.08)]">
              <div className="flex gap-1.5 items-center">
                <span className="w-2.5 h-2.5 bg-[#D29C1D] rounded-full typing-dot" />
                <span className="w-2.5 h-2.5 bg-[#D29C1D] rounded-full typing-dot" />
                <span className="w-2.5 h-2.5 bg-[#D29C1D] rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-3.5 pt-2.5 pb-2 flex gap-2 bg-[#FBF8EE] border-t border-[#DEC691]/40">
        <button
          onClick={() => setInput("mandale 0.01 tRBTC a ")}
          className="flex-1 text-[11px] font-bold bg-[#6A4E2F]/[0.07] hover:bg-[#6A4E2F]/[0.13] text-[#6A4E2F] rounded-full py-2.5 border border-[#DEC691]/60 transition-all active:scale-95"
        >
          💸 Enviar
        </button>
        <button
          onClick={() => setInput("ahorra el 10%")}
          className="flex-1 text-[11px] font-bold bg-[#6A4E2F]/[0.07] hover:bg-[#6A4E2F]/[0.13] text-[#6A4E2F] rounded-full py-2.5 border border-[#DEC691]/60 transition-all active:scale-95"
        >
          💰 Ahorrar
        </button>
        <button
          onClick={() => setInput("cuanto tengo")}
          className="flex-1 text-[11px] font-bold bg-[#6A4E2F]/[0.07] hover:bg-[#6A4E2F]/[0.13] text-[#6A4E2F] rounded-full py-2.5 border border-[#DEC691]/60 transition-all active:scale-95"
        >
          📊 Balance
        </button>
      </div>

      {/* Pending WhatsApp Transaction */}
      {pendingWATx && (
        <div className="mx-3.5 mb-2 p-4 bg-[#6A4E2F] rounded-2xl shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-[11px] font-bold text-[#FBDC5C] uppercase tracking-wide">
                📲 Transacción desde WhatsApp
              </p>
              {pendingWATx.action === "transfer" && pendingWATx.to && (
                <p className="text-sm text-[#FBF8EE] mt-1">
                  Enviar{" "}
                  <span className="font-black text-[#FBDC5C]">
                    {pendingWATx.amount} {pendingWATx.token}
                  </span>
                  {" a "}
                  <span className="font-mono text-xs bg-white/15 px-1.5 py-0.5 rounded text-[#DEC691]">
                    {pendingWATx.to.slice(0, 6)}…{pendingWATx.to.slice(-4)}
                  </span>
                </p>
              )}
              {pendingWATx.action === "balance" && (
                <p className="text-sm text-[#FBF8EE]/80 mt-1">Consultar balance</p>
              )}
              {pendingWATx.action === "autosave" && (
                <p className="text-sm text-[#FBF8EE] mt-1">
                  Auto-ahorro{" "}
                  <span className="font-black text-[#FBDC5C]">{pendingWATx.percentage}%</span>
                </p>
              )}
            </div>
            <button
              onClick={() => setPendingWATx(null)}
              className="text-[#DEC691]/50 hover:text-[#DEC691] transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmWATx}
              disabled={!isConnected || isLoading}
              className="flex-1 bg-[#FBDC5C] hover:bg-[#FFE77A] disabled:opacity-40 text-[#6A4E2F] text-sm font-black py-2.5 rounded-xl transition-colors active:scale-95"
            >
              {isConnected ? "Confirmar en MetaMask" : "Conectá tu wallet primero"}
            </button>
            <button
              onClick={() => setPendingWATx(null)}
              className="px-4 bg-white/10 hover:bg-white/20 text-[#FBF8EE]/70 text-xs py-2.5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2.5 px-3.5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2 bg-[#FBF8EE]">
        <Input
          placeholder="Escribí tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
          className="flex-1 bg-white border-[#DEC691]/70 text-[#3D2310] placeholder:text-[#6A4E2F]/35 rounded-2xl focus-visible:ring-[#D29C1D]/40 focus-visible:border-[#D29C1D] h-12 text-[14px] shadow-[0_1px_4px_rgba(106,78,47,0.08)]"
        />
        <Button
          onClick={handleSend}
          disabled={isLoading}
          className="rounded-full w-12 h-12 p-0 bg-[#6A4E2F] hover:bg-[#5A3E1F] disabled:opacity-50 flex-shrink-0 shadow-lg shadow-[#6A4E2F]/25"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#FBDC5C]" />
          ) : (
            <Send className="h-5 w-5 text-[#FBDC5C]" />
          )}
        </Button>
      </div>
    </div>
  );
}
