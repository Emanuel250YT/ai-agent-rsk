/**
 * BlitzPay AutoSave — core calculation logic.
 * Pure functions, no side effects, fully testable.
 */

export interface AutoSaveRule {
  percentage: number; // 1–100
  active: boolean;
}

export interface AutoSaveCalculation {
  savingsAmount: bigint; // wei
  remainder: bigint; // wei
  percentage: number;
}

/**
 * Calculate how much to save given an incoming amount and a rule.
 * Uses integer math on wei values to avoid floating-point drift.
 *
 * @param incomingWei  The incoming amount in wei (as bigint)
 * @param rule         The active savings rule
 * @returns            Calculation result with savingsAmount and remainder
 */
export function calculateSavings(
  incomingWei: bigint,
  rule: AutoSaveRule
): AutoSaveCalculation {
  if (!rule.active || rule.percentage <= 0) {
    return { savingsAmount: 0n, remainder: incomingWei, percentage: 0 };
  }

  const pct = BigInt(Math.min(100, Math.max(1, Math.floor(rule.percentage))));
  const savingsAmount = (incomingWei * pct) / 100n;
  const remainder = incomingWei - savingsAmount;

  return { savingsAmount, remainder, percentage: rule.percentage };
}

/**
 * Validate that a percentage is within the allowed range.
 */
export function isValidPercentage(value: unknown): value is number {
  return typeof value === "number" && value >= 1 && value <= 100 && Number.isFinite(value);
}

/**
 * Format a wei amount as a human-readable tRBTC string.
 */
export function formatWeiAsRBTC(wei: bigint, decimals = 6): string {
  const divisor = 10n ** 18n;
  const whole = wei / divisor;
  const fraction = wei % divisor;

  // Build decimal string
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, decimals);
  return `${whole}.${fractionStr} tRBTC`;
}
