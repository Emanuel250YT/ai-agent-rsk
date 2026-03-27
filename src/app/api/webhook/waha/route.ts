import { NextResponse } from "next/server";

/**
 * WAHA (WhatsApp HTTP API) Webhook
 * Receives incoming WhatsApp messages and converts them to BlitzPay chat events.
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
    _data?: {
      notifyName?: string;
    };
  };
}

interface BlitzPayEvent {
  source: "whatsapp";
  from: string;
  senderName: string;
  message: string;
  timestamp: number;
  rawId: string;
}

function parseWAHAMessage(body: WAHAMessage): BlitzPayEvent | null {
  if (body.event !== "message") return null;

  const { payload } = body;
  if (!payload?.body?.trim()) return null;

  return {
    source: "whatsapp",
    from: payload.from,
    senderName: payload._data?.notifyName ?? payload.from,
    message: payload.body.trim(),
    timestamp: payload.timestamp,
    rawId: payload.id,
  };
}

/**
 * Parse shorthand BlitzPay commands from WhatsApp messages.
 * e.g. "/send 0.01" → { action: "transfer", amount: 0.01 }
 */
function parseCommand(message: string): Record<string, unknown> | null {
  const trimmed = message.trim().toLowerCase();

  const sendMatch = trimmed.match(/^\/send\s+([\d.]+)(?:\s+to\s+(\S+))?/);
  if (sendMatch) {
    return {
      action: "transfer",
      amount: parseFloat(sendMatch[1]),
      to: sendMatch[2] ?? null,
    };
  }

  if (trimmed === "/balance" || trimmed === "/saldo") {
    return { action: "balance" };
  }

  const saveMatch = trimmed.match(/^\/save\s+([\d.]+)%/);
  if (saveMatch) {
    return { action: "autosave", percentage: parseFloat(saveMatch[1]) };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    // Validate webhook secret to prevent unauthorized calls
    const secret = req.headers.get("x-waha-secret");
    const expectedSecret = process.env.WAHA_WEBHOOK_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: WAHAMessage = await req.json();
    const event = parseWAHAMessage(body);

    if (!event) {
      // Not a message event — ignore silently
      return NextResponse.json({ ok: true, skipped: true });
    }

    const command = parseCommand(event.message);

    const blitzEvent = {
      ...event,
      command,
      processedAt: new Date().toISOString(),
    };

    // In a full implementation, emit this to a WebSocket / message queue.
    // For now, log and optionally forward to the AI endpoint.
    console.log("[WAHA Webhook] Received event:", JSON.stringify(blitzEvent, null, 2));

    // If it's a natural-language message (not a slash command),
    // forward to the AI endpoint for interpretation.
    if (!command) {
      const aiResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "chat",
            question: event.message,
            address: "",
            messageHistory: [],
          }),
        }
      );

      const aiData = await aiResponse.json();
      return NextResponse.json({ ok: true, event: blitzEvent, ai: aiData });
    }

    return NextResponse.json({ ok: true, event: blitzEvent });
  } catch (error) {
    console.error("[WAHA Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "BlitzPay WAHA Webhook",
    version: "1.0.0",
  });
}
