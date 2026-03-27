"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useAppKitAccount } from "@reown/appkit/react";
import { Zap, ShieldCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <p className="font-bold text-white">BlitzPay</p>
            <p className="text-xs text-white/40">Vinculación de wallet</p>
          </div>
        </div>

        {/* Error state */}
        {tokenError && (
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Token inválido</p>
              <p className="text-xs text-white/40 mt-0.5">{tokenError}</p>
            </div>
          </div>
        )}

        {/* Success state */}
        {linked && (
          <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-400">¡Wallet vinculada!</p>
              <p className="text-xs text-white/40 mt-0.5">
                Ya podés usar BlitzPay directamente desde WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Linking form */}
        {!tokenError && !linked && tokenInfo && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <span>
                  Solicitud desde WhatsApp:{" "}
                  <span className="text-white/70">{tokenInfo.phone}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Clock className="w-4 h-4" />
                <span>Expira en {Math.floor(tokenInfo.expiresIn / 60)} min</span>
              </div>
            </div>

            <p className="text-sm text-white/60 leading-relaxed">
              Conectá tu wallet para vincularla a tu número de WhatsApp. Una vez vinculada, podés
              enviar pagos y consultar tu balance directamente desde la app de mensajes.
            </p>

            <div className="space-y-3">
              <ConnectButton />
              {isConnected && address && (
                <Button
                  onClick={handleLink}
                  disabled={linking}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold"
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
          <p className="text-sm text-white/40 text-center py-4">Verificando token...</p>
        )}
      </div>
    </div>
  );
}
