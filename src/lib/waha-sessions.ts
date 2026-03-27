/**
 * In-memory session store for WhatsApp ↔ Wallet linking.
 * Maps phone numbers to EVM wallet addresses.
 * Replace with Redis / Postgres in production.
 */

export interface WASession {
  phone: string;           // normalized international format, e.g. "5491112345678"
  walletAddress?: string;  // linked EVM address
  pendingToken?: string;   // one-time link token (UUID)
  pendingExpiry?: number;  // token expiry (ms timestamp)
  linkedAt?: number;       // when wallet was linked
}

const store = new Map<string, WASession>();
const tokenIndex = new Map<string, string>(); // token → phone

/** Strip WhatsApp suffix and non-digits. e.g. "5491112345678@c.us" → "5491112345678" */
export function normalizePhone(raw: string): string {
  return raw.replace(/@.*/, "").replace(/\D/g, "");
}

export function getSession(phone: string): WASession {
  if (!store.has(phone)) store.set(phone, { phone });
  return store.get(phone)!;
}

export function isLinked(phone: string): boolean {
  return !!store.get(phone)?.walletAddress;
}

export function getWallet(phone: string): string | undefined {
  return store.get(phone)?.walletAddress;
}

/**
 * Creates a 15-minute one-time token for wallet linking.
 * Replaces any existing pending token for this phone.
 */
export function createLinkToken(phone: string): string {
  const token = crypto.randomUUID();
  const session = getSession(phone);
  if (session.pendingToken) tokenIndex.delete(session.pendingToken);
  session.pendingToken = token;
  session.pendingExpiry = Date.now() + 15 * 60 * 1000;
  store.set(phone, session);
  tokenIndex.set(token, phone);
  return token;
}

/** Resolves a token to its session. Returns null if unknown or expired. */
export function resolveToken(token: string): WASession | null {
  const phone = tokenIndex.get(token);
  if (!phone) return null;
  const session = store.get(phone);
  if (!session?.pendingExpiry || session.pendingExpiry < Date.now()) {
    tokenIndex.delete(token);
    return null;
  }
  return session;
}

/**
 * Links a wallet address to the session identified by token.
 * Returns true on success, false if token is invalid/expired.
 */
export function linkWallet(token: string, walletAddress: string): boolean {
  const session = resolveToken(token);
  if (!session) return false;
  session.walletAddress = walletAddress;
  session.linkedAt = Date.now();
  if (session.pendingToken) tokenIndex.delete(session.pendingToken);
  session.pendingToken = undefined;
  session.pendingExpiry = undefined;
  store.set(session.phone, session);
  return true;
}
