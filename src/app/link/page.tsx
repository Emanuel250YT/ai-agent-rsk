"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useAppKitAccount } from "@reown/appkit/react";
import { ShieldCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface TokenInfo {
  phone: string;
  expiresIn: number;
}

export default function LinkPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const { address, isConnected } = useAppKitAccount();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenError("Falta el token de vinculación.");
      return;
    }
    setToken(t);
    fetch(`/api/auth/link?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((data: { error?: string; valid?: boolean; phone?: string; expiresIn?: number }) => {
        if (data.error) setTokenError(data.error);
        else setTokenInfo({ phone: data.phone!, expiresIn: data.expiresIn! });
      })
      .catch(() => setTokenError("Error al verificar el token."));
  }, []);

  const handleLink = async () => {
    if (!token || !address) return;
    setLinking(true);
    try {
      const res = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, walletAddress: address }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (data.ok) setLinked(true);
      else setTokenError(data.error ?? "Error al vincular");
    } catch {
      setTokenError("Error de red. Intentá de nuevo.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen blitz-chat-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-[#DEC691]/60 rounded-2xl p-6 space-y-5 shadow-[0_4px_24px_rgba(106,78,47,0.10)]">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0">
            <Image src="/img/blitz-robot.png" width={48} height={48} alt="BlitzPay" className="w-full h-full object-cover" priority />
          </div>
          <div>
            <p className="font-brand font-black text-[#6A4E2F]">BlitzPay</p>
            <p className="text-xs text-[#6A4E2F]/50">Vinculación de wallet</p>
          </div>
        </div>

        {/* Error state */}
        {tokenError && (
          <div className="flex items-start gap-3 p-3 bg-[#6A4E2F]/5 border border-[#D29C1D]/30 rounded-xl">
            <XCircle className="w-5 h-5 text-[#D29C1D] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#6A4E2F]">Token inválido</p>
              <p className="text-xs text-[#6A4E2F]/50 mt-0.5">{tokenError}</p>
            </div>
          </div>
        )}

        {/* Success state */}
        {linked && (
          <div className="flex items-start gap-3 p-3 bg-[#FBDC5C]/25 border border-[#D29C1D]/40 rounded-xl">
            <CheckCircle className="w-5 h-5 text-[#D29C1D] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#6A4E2F]">¡Wallet vinculada!</p>
              <p className="text-xs text-[#6A4E2F]/60 mt-0.5">
                Ya podés usar BlitzPay directamente desde WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Linking form */}
        {!tokenError && !linked && tokenInfo && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#6A4E2F]/60">
                <ShieldCheck className="w-4 h-4 text-[#D29C1D]" />
                <span>
                  Solicitud desde WhatsApp:{" "}
                  <span className="text-[#6A4E2F] font-semibold">{tokenInfo.phone}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6A4E2F]/60">
                <Clock className="w-4 h-4 text-[#DEC691]" />
                <span>Expira en {Math.floor(tokenInfo.expiresIn / 60)} min</span>
              </div>
            </div>

            <p className="text-sm text-[#6A4E2F]/70 leading-relaxed">
              Conectá tu wallet para vincularla a tu número de WhatsApp. Una vez vinculada, podés
              enviar pagos y consultar tu balance directamente desde la app de mensajes.
            </p>

            <div className="space-y-3">
              <ConnectButton />
              {isConnected && address && (
                <Button
                  onClick={handleLink}
                  disabled={linking}
                  className="w-full bg-[#6A4E2F] hover:bg-[#5A3E1F] text-[#FBDC5C] font-bold transition-all active:scale-95"
                >
                  {linking
                    ? "Vinculando..."
                    : `Vincular ${address.slice(0, 6)}…${address.slice(-4)}`}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Loading state */}
        {!tokenError && !linked && !tokenInfo && (
          <p className="text-sm text-[#6A4E2F]/50 text-center py-4">Verificando token...</p>
        )}
      </div>
    </div>
  );
}
