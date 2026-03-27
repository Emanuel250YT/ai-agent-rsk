import { NextResponse } from "next/server";
import { linkWallet, resolveToken } from "@/lib/waha-sessions";
import { isAddress } from "viem";

/**
 * GET /api/auth/link?token=xxx
 * Validates the token and returns masked phone + expiry info.
 * Used by the /link page to show who requested the link.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const session = resolveToken(token);
  if (!session) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 404 });
  }

  // Mask all but last 4 digits of phone
  const p = session.phone;
  const masked = p.slice(0, 3) + "·".repeat(Math.max(0, p.length - 6)) + p.slice(-3);

  return NextResponse.json({
    valid: true,
    phone: masked,
    expiresIn: Math.round(((session.pendingExpiry ?? 0) - Date.now()) / 1000),
  });
}

/**
 * POST /api/auth/link
 * Body: { token: string; walletAddress: string }
 * Links a wallet address to the WhatsApp session identified by token.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, walletAddress } = body as { token?: string; walletAddress?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }
    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json({ error: "Dirección de wallet inválida" }, { status: 400 });
    }

    const ok = linkWallet(token, walletAddress);
    if (!ok) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 410 });
    }

    return NextResponse.json({ ok: true, message: "Wallet vinculada exitosamente" });
  } catch {
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
