/**
 * BlitzPay Demo Seed Script
 * Simulates the full hackathon demo flow in the console.
 *
 * Usage: npx ts-node scripts/seed.ts
 * (or: npx tsx scripts/seed.ts)
 *
 * Steps:
 *   1. Connect wallet (mocked)
 *   2. Check balance
 *   3. Send a payment
 *   4. Activate auto-save rule
 *   5. Print demo summary
 */

const DEMO_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const DEMO_RECIPIENT = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function post(path: string, body: object) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function log(step: number, label: string, detail?: string) {
  const prefix = `\x1b[33m[Step ${step}]\x1b[0m \x1b[36m${label}\x1b[0m`;
  console.log(detail ? `${prefix}\n  ${detail}` : prefix);
}

async function main() {
  console.log("\n\x1b[1m⚡ BlitzPay — Hackathon Demo Seed\x1b[0m\n");

  // ── Step 1: Login simulation ────────────────────────────────────────────
  log(1, "Wallet connected", `Address: ${DEMO_WALLET}`);

  // ── Step 2: Natural language balance query ──────────────────────────────
  log(2, "Querying balance via AI…");
  try {
    const balanceRes = await post("/api/ai", {
      type: "chat",
      question: "cuanto tengo",
      address: DEMO_WALLET,
      messageHistory: [],
    });
    console.log("  AI Response:", JSON.stringify(balanceRes, null, 2));
  } catch (e) {
    console.log("  (skipped — server not running)");
  }

  // ── Step 3: Send payment via natural language ───────────────────────────
  log(3, `Sending 0.01 tRBTC to ${DEMO_RECIPIENT}…`);
  try {
    const sendRes = await post("/api/ai", {
      type: "chat",
      question: `mandale 0.01 tRBTC a ${DEMO_RECIPIENT}`,
      address: DEMO_WALLET,
      messageHistory: [],
    });
    console.log("  AI Response:", JSON.stringify(sendRes, null, 2));
  } catch (e) {
    console.log("  (skipped — server not running)");
  }

  // ── Step 4: Activate auto-save ──────────────────────────────────────────
  log(4, "Activating auto-save rule: 10%…");
  try {
    const saveRes = await post("/api/ai", {
      type: "chat",
      question: "ahorra el 10%",
      address: DEMO_WALLET,
      messageHistory: [],
    });
    console.log("  AI Response:", JSON.stringify(saveRes, null, 2));
  } catch (e) {
    console.log("  (skipped — server not running)");
  }

  // ── Step 5: WAHA webhook simulation ────────────────────────────────────
  log(5, "Simulating WAHA WhatsApp message…");
  try {
    const wahaRes = await post("/api/webhook/waha", {
      event: "message",
      session: "demo",
      payload: {
        id: "abc123",
        timestamp: Math.floor(Date.now() / 1000),
        from: "5491100000000@c.us",
        body: "/balance",
        hasMedia: false,
        _data: { notifyName: "Juan" },
      },
    });
    console.log("  Webhook Response:", JSON.stringify(wahaRes, null, 2));
  } catch (e) {
    console.log("  (skipped — server not running)");
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`
\x1b[32m✅ Demo seed complete!\x1b[0m

  Wallet : ${DEMO_WALLET}
  Network: Rootstock Testnet (chain 31)
  App URL: ${APP_URL}

  To run the full demo, start the app with:
    npm run dev

  Then open: ${APP_URL}
`);
}

main().catch((err) => {
  console.error("\x1b[31m✗ Seed failed:\x1b[0m", err.message);
  process.exit(1);
});
