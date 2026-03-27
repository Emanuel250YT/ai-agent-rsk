/**
 * Shared helper to send a WhatsApp reply via WAHA.
 * Usable from any server-side route.
 */
export async function sendReply(chatId: string, text: string): Promise<void> {
  const wahaUrl = process.env.WAHA_API_URL;
  if (!wahaUrl) {
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

/** Converts a normalized phone number back to a WAHA chatId */
export function phoneToChatId(phone: string): string {
  return `${phone}@c.us`;
}
