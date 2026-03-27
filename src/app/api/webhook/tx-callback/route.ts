import { NextResponse } from "next/server";
import { sendReply, phoneToChatId } from "@/lib/waha-reply";
import { isLinked, getWallet } from "@/lib/waha-sessions";

/**
 * POST /api/webhook/tx-callback
 *
 * Called by the web app after a MetaMask transaction is signed/confirmed.
 * Sends a WhatsApp confirmation message back to the user.
 *
 * Body:
 *   phone      — normalized phone (e.g. "5491112345678")
 *   action     — "transfer" | "balance" | "autosave"
 *   txHash?    — tx hash for transfer
 *   amount?    — amount transferred
 *   token?     — token symbol
 *   to?        — recipient address
 *   balance?   — balance value (for balance queries)
 *   symbol?    — balance symbol
 *   percentage? — percentage (for autosave)
 *   error?     — error message if tx failed
 */

interface TxCallbackBody {
  phone: string;
  action: "transfer" | "balance" | "autosave";
  txHash?: string;
  amount?: number;
  token?: string;
  to?: string;
  balance?: number;
  symbol?: string;
  percentage?: number;
  error?: string;
}

export async function POST(req: Request) {
  try {
    const body: TxCallbackBody = await req.json();
    const { phone, action, error } = body;

    if (!phone || !action) {
      return NextResponse.json({ error: "Missing phone or action" }, { status: 400 });
    }

    // Security: only send callbacks to linked phones
    if (!isLinked(phone)) {
      return NextResponse.json({ error: "Phone not linked" }, { status: 403 });
    }

    const explorerBase = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "https://explorer.testnet.rsk.co/tx/";
    const chatId = phoneToChatId(phone);
    const wallet = getWallet(phone)!;

    let message: string;

    if (error) {
      message =
        `❌ *Operación fallida*\n\n` +
        `${error}\n\n` +
        `_Wallet: \`${wallet.slice(0, 6)}…${wallet.slice(-4)}\`_`;
    } else if (action === "transfer" && body.txHash) {
      const txShort = `${body.txHash.slice(0, 8)}…${body.txHash.slice(-6)}`;
      message =
        `✅ *¡Transferencia confirmada!*\n\n` +
        `• Monto: *${body.amount} ${body.token ?? "tRBTC"}*\n` +
        `• Para: \`${body.to?.slice(0, 6)}…${body.to?.slice(-4)}\`\n` +
        `• Tx: \`${txShort}\`\n\n` +
        `🔍 ${explorerBase}${body.txHash}`;
    } else if (action === "balance") {
      message =
        `💰 *Tu balance actual*\n\n` +
        `*${body.balance?.toFixed(6)} ${body.symbol ?? "tRBTC"}*\n\n` +
        `_Wallet: \`${wallet.slice(0, 6)}…${wallet.slice(-4)}\`_`;
    } else if (action === "autosave") {
      message =
        `💰 *Auto-ahorro activado*\n\n` +
        `Guardaré el *${body.percentage}%* de cada ingreso en tu vault DeFi en Rootstock. ¡Listo!`;
    } else {
      return NextResponse.json({ ok: true, skipped: "no_match" });
    }

    await sendReply(chatId, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tx-callback] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
