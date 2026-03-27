"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { Loader2, Send, ExternalLink, Zap, TrendingUp, X, Wallet } from "lucide-react";
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
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300 underline"
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
                <div className="space-y-1">
                  <p className="text-white/60 text-xs">Tu balance actual</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {balance.displayValue.toFixed(6)}{" "}
                    <span className="text-base text-white/70">{balance.symbol}</span>
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

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#0a0a0a] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-white/10 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">BlitzPay</p>
            <p className="text-[11px] text-green-400 leading-tight">● Online · Rootstock Testnet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {address && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40 bg-white/5 rounded-full px-2.5 py-1">
              <Wallet className="w-3 h-3" />
              {`${address.slice(0, 5)}…${address.slice(-4)}`}
            </span>
          )}
          <ConnectButton />
        </div>
      </div>

      {/* AutoSave Banner */}
      {autoSave?.active && (
        <div className="flex items-center justify-between px-4 py-2 bg-green-500/10 border-b border-green-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-300">
              Auto-ahorro activo: <span className="font-semibold">{autoSave.percentage}%</span> de cada ingreso
            </span>
          </div>
          <button
            onClick={() => setAutoSave(null)}
            className="text-green-400/50 hover:text-green-400 transition-colors ml-2"
            aria-label="Cancelar auto-ahorro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        ref={containerRef}
      >
        {messages.map(({ role, content, timestamp }, idx) => (
          <div
            key={idx}
            className={`flex items-end gap-2 ${role === "user" ? "justify-end" : "justify-start"}`}
          >
            {role === "agent" && (
              <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20">
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${role === "user"
                ? "bg-orange-500 text-white rounded-br-sm shadow-md shadow-orange-500/20"
                : "bg-[#1c1c1c] text-white/90 rounded-bl-sm border border-white/[0.06]"
                }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {content}
              </div>
              <div
                className={`text-[10px] mt-1 ${role === "user" ? "text-orange-200/70" : "text-white/25"
                  } text-right`}
              >
                {timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" fill="white" />
            </div>
            <div className="bg-[#1c1c1c] rounded-2xl rounded-bl-sm px-4 py-3 border border-white/[0.06]">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 pt-2 pb-1 flex gap-2 border-t border-white/[0.06]">
        <button
          onClick={() => setInput("mandale 0.01 tRBTC a ")}
          className="flex-1 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 rounded-full py-2 border border-white/10 transition-all"
        >
          💸 Enviar
        </button>
        <button
          onClick={() => setInput("ahorra el 10%")}
          className="flex-1 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 rounded-full py-2 border border-white/10 transition-all"
        >
          💰 Ahorrar
        </button>
        <button
          onClick={() => setInput("cuanto tengo")}
          className="flex-1 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 rounded-full py-2 border border-white/10 transition-all"
        >
          📊 Balance
        </button>
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2 px-4 pb-6 pt-2">
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
          className="flex-1 bg-[#1c1c1c] border-white/10 text-white placeholder:text-white/25 rounded-2xl focus-visible:ring-orange-500/40 h-11"
        />
        <Button
          onClick={handleSend}
          disabled={isLoading}
          className="rounded-full w-11 h-11 p-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 flex-shrink-0 shadow-lg shadow-orange-500/20"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
