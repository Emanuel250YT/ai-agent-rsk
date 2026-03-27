import { NextResponse } from "next/server";
import {
  isLinked,
  getWallet,
  normalizePhone,
  createLinkToken,
  getSession,
} from "@/lib/waha-sessions";

/**
 * BlitzPay WAHA Webhook v2
 *
 * Flow:
 *  1. New user → send wallet-link URL (15-min one-time token)
 *  2. Linked user + slash command → send transaction URL or direct reply
 *  3. Linked user + free text → AI processes and replies with text or tx URL
 *
 * Setup: configure WAHA to POST to /api/webhook/waha
 * Docs: https://waha.devlike.pro/docs/how-to/webhooks/
 */

interface WAHAMessage {
  event: string;
  session: string;
  payload: {
    id: string;
    timestamp: number;
    from: string;
    body: string;
    hasMedia: boolean;
    _data?: { notifyName?: string };
  };
}

// ─── WAHA reply helper ────────────────────────────────────────────────────────

async function sendReply(chatId: string, text: string): Promise<void> {
  const wahaUrl = process.env.WAHA_API_URL;
  if (!wahaUrl) {
    // No WAHA server configured — log only (useful for local dev)
    console.log(`[WAHA → ${chatId}] ${text}`);
    return;
  }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.WAHA_API_KEY) headers["X-Api-Key"] = process.env.WAHA_API_KEY;
    await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        session: process.env.WAHA_SESSION ?? "default",
        chatId,
        text,
      }),
    });
  } catch (err) {
    console.error("[WAHA sendReply] Failed:", err);
  }
}

// ─── Command parser ───────────────────────────────────────────────────────────

type Cmd =
  | { action: "help" }
  | { action: "link" }
  | { action: "balance" }
  | { action: "transfer"; amount: number; to: string | null; token: string }
  | { action: "autosave"; percentage: number };

function parseCommand(msg: string): Cmd | null {
  const t = msg.trim().toLowerCase();

  if (t === "/help" || t === "ayuda" || t === "help") return { action: "help" };
  if (t === "/link" || t === "vincular") return { action: "link" };
  if (t === "/balance" || t === "/saldo" || t === "saldo" || t === "balance") {
    return { action: "balance" };
  }

  // /send 0.01 [to 0xABC] — also accepts natural-like "enviar 0.01"
  const sendRe = /^\/?(send|enviar|mandar)\s+([\d.]+)\s*(?:(?:a|to)\s+(\S+))?/i;
  const sm = t.match(sendRe);
  if (sm) {
    return { action: "transfer", amount: parseFloat(sm[2]), to: sm[3] ?? null, token: "tRBTC" };
  }

  const saveRe = /^\/save\s+([\d.]+)%/;
  const sv = t.match(saveRe);
  if (sv) return { action: "autosave", percentage: parseFloat(sv[1]) };

  return null;
}

// ─── Deep-link builder ────────────────────────────────────────────────────────

function appUrl(params: Record<string, string>): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}?${new URLSearchParams(params).toString()}`;
}

// ─── Webhook POST ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // Validate optional webhook secret
    const secret = req.headers.get("x-waha-secret");
    const expected = process.env.WAHA_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: WAHAMessage = await req.json();
    if (body.event !== "message" || !body.payload?.body?.trim()) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { payload } = body;
    const chatId = payload.from;                                    // e.g. "5491112345678@c.us"
    const phone = normalizePhone(payload.from);                     // e.g. "5491112345678"
    const text = payload.body.trim();
    const name = payload._data?.notifyName ?? phone;

    console.log(`[WAHA] ${name} (${phone}): ${text}`);

    // ── Step 1: Auth check ────────────────────────────────────────────────────
    if (!isLinked(phone)) {
      const token = createLinkToken(phone);
      const linkUrl = appUrl({ token });

      await sendReply(
        chatId,
        `👋 ¡Hola ${name}! Soy *BlitzPay* ⚡, tu asistente DeFi en Rootstock.\n\n` +
        `Para empezar, vinculá tu wallet MetaMask tocando este enlace:\n${linkUrl}\n\n` +
        `_El enlace expira en 15 minutos._`
      );
      return NextResponse.json({ ok: true, phase: "auth_pending" });
    }

    const walletAddress = getWallet(phone)!;
    getSession(phone); // ensure session exists

    // ── Step 2: Parse command ─────────────────────────────────────────────────
    const cmd = parseCommand(text);

    if (cmd?.action === "link") {
      const token = createLinkToken(phone);
      await sendReply(chatId, `🔗 Nuevo enlace para re-vincular tu wallet:\n${appUrl({ token })}\n_Expira en 15 min._`);
      return NextResponse.json({ ok: true, phase: "relink" });
    }

    if (cmd?.action === "help") {
      await sendReply(
        chatId,
        `⚡ *BlitzPay — Comandos*\n\n` +
        `💸 */send 0.01* — Enviar tRBTC\n` +
        `📊 */balance* — Ver tu saldo\n` +
        `💰 */save 10%* — Activar auto-ahorro\n` +
        `🔗 */link* — Cambiar wallet vinculada\n\n` +
        `O escribime en lenguaje natural 😊`
      );
      return NextResponse.json({ ok: true });
    }

    if (cmd?.action === "transfer") {
      if (!cmd.to) {
        // Missing recipient — ask for it
        await sendReply(
          chatId,
          `💸 ¿A qué dirección querés enviar *${cmd.amount} ${cmd.token}*?\n\nResponde con la dirección 0x...`
        );
        return NextResponse.json({ ok: true, waiting: "recipient" });
      }

      // Build web app URL so user confirms the tx in MetaMask
      const txUrl = appUrl({
        action: "transfer",
        to: cmd.to,
        amount: String(cmd.amount),
        token: cmd.token,
        wha: "1",
      });

      await sendReply(
        chatId,
        `💸 *Confirmar envío*\n\n` +
        `• Monto: *${cmd.amount} ${cmd.token}*\n` +
        `• Para: \`${cmd.to.slice(0, 6)}…${cmd.to.slice(-4)}\`\n\n` +
        `Tocá para firmar con MetaMask:\n${txUrl}`
      );
      return NextResponse.json({ ok: true, cmd });
    }

    if (cmd?.action === "balance") {
      const balUrl = appUrl({ action: "balance", wha: "1" });
      await sendReply(
        chatId,
        `📊 Consultá tu saldo en tiempo real:\n${balUrl}\n\n` +
        `_Wallet: \`${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}\`_`
      );
      return NextResponse.json({ ok: true, cmd });
    }

    if (cmd?.action === "autosave") {
      await sendReply(
        chatId,
        `💰 Auto-ahorro del *${cmd.percentage}%* activado.\n\nCada ingreso que recibas se guardará automáticamente en tu vault DeFi.`
      );
      return NextResponse.json({ ok: true, cmd });
    }

    // ── Step 3: Free-text → AI ────────────────────────────────────────────────
    const aiRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ai`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          question: text,
          address: walletAddress,
          messageHistory: [],
        }),
      }
    );
    const aiData = await aiRes.json();

    let reply: string = aiData.analysis ?? "No entendí tu mensaje. Escribí /help para ver los comandos.";

    // If AI triggered a function call, convert to a web URL instead of raw text
    if (aiData.functionCall) {
      const { name: fn, arguments: args } = aiData.functionCall as {
        name: string;
        arguments: Record<string, unknown>;
      };

      if (fn === "transfer" && args.address && args.amount) {
        const txUrl = appUrl({
          action: "transfer",
          to: String(args.address),
          amount: String(args.amount),
          token: String(args.token1 ?? "tRBTC"),
          wha: "1",
        });
        reply =
          `💸 *Confirmar envío*\n\n` +
          `• Monto: *${args.amount} ${args.token1 ?? "tRBTC"}*\n` +
          `• Para: \`${String(args.address).slice(0, 6)}…${String(args.address).slice(-4)}\`\n\n` +
          `Tocá para firmar con MetaMask:\n${txUrl}`;
      } else if (fn === "balance") {
        const balUrl = appUrl({ action: "balance", wha: "1" });
        reply = `📊 Consultá tu saldo:\n${balUrl}`;
      } else if (fn === "autosave" && args.percentage) {
        const saveUrl = appUrl({
          action: "autosave",
          percentage: String(args.percentage),
          wha: "1",
        });
        reply =
          `💰 Auto-ahorro del *${args.percentage}%* listo para activar:\n${saveUrl}`;
      }
    }

    await sendReply(chatId, reply);
    return NextResponse.json({ ok: true, phase: "ai_processed" });
  } catch (error) {
    console.error("[WAHA Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "BlitzPay WAHA Webhook v2",
    features: ["session-auth", "wallet-link", "tx-deeplinks", "ai-chat"],
  });
}

