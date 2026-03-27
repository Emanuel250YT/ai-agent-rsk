import {
  calculateSavings,
  isValidPercentage,
  formatWeiAsRBTC,
  type AutoSaveRule,
} from "@/lib/autosave";

describe("calculateSavings", () => {
  const activeRule: AutoSaveRule = { percentage: 10, active: true };

  it("saves the correct percentage of incoming funds", () => {
    const incoming = 100n * 10n ** 18n; // 100 tRBTC in wei
    const result = calculateSavings(incoming, activeRule);

    expect(result.savingsAmount).toBe(10n * 10n ** 18n); // 10 tRBTC
    expect(result.remainder).toBe(90n * 10n ** 18n); // 90 tRBTC
    expect(result.percentage).toBe(10);
  });

  it("returns zero savings when rule is inactive", () => {
    const incoming = 100n * 10n ** 18n;
    const inactiveRule: AutoSaveRule = { percentage: 20, active: false };
    const result = calculateSavings(incoming, inactiveRule);

    expect(result.savingsAmount).toBe(0n);
    expect(result.remainder).toBe(incoming);
  });

  it("handles 100% savings rule", () => {
    const incoming = 5n * 10n ** 18n;
    const fullSave: AutoSaveRule = { percentage: 100, active: true };
    const result = calculateSavings(incoming, fullSave);

    expect(result.savingsAmount).toBe(incoming);
    expect(result.remainder).toBe(0n);
  });

  it("handles 1% savings rule", () => {
    const incoming = 1000n * 10n ** 18n;
    const minSave: AutoSaveRule = { percentage: 1, active: true };
    const result = calculateSavings(incoming, minSave);

    expect(result.savingsAmount).toBe(10n * 10n ** 18n);
    expect(result.remainder).toBe(990n * 10n ** 18n);
  });

  it("savings + remainder always equal incoming amount", () => {
    const amounts = [1n, 1337n, 10n ** 18n, 999999999999999999n];
    const percentages = [5, 17, 33, 50, 99];

    for (const amount of amounts) {
      for (const pct of percentages) {
        const rule: AutoSaveRule = { percentage: pct, active: true };
        const { savingsAmount, remainder } = calculateSavings(amount, rule);
        expect(savingsAmount + remainder).toBe(amount);
      }
    }
  });
});

describe("isValidPercentage", () => {
  it("accepts values between 1 and 100", () => {
    expect(isValidPercentage(1)).toBe(true);
    expect(isValidPercentage(50)).toBe(true);
    expect(isValidPercentage(100)).toBe(true);
  });

  it("rejects 0 and values over 100", () => {
    expect(isValidPercentage(0)).toBe(false);
    expect(isValidPercentage(101)).toBe(false);
    expect(isValidPercentage(-1)).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(isValidPercentage("10")).toBe(false);
    expect(isValidPercentage(null)).toBe(false);
    expect(isValidPercentage(undefined)).toBe(false);
    expect(isValidPercentage(NaN)).toBe(false);
    expect(isValidPercentage(Infinity)).toBe(false);
  });
});

describe("formatWeiAsRBTC", () => {
  it("formats 1 RBTC correctly", () => {
    const oneRBTC = 10n ** 18n;
    expect(formatWeiAsRBTC(oneRBTC)).toBe("1.000000 tRBTC");
  });

  it("formats 0.01 RBTC correctly", () => {
    const small = 10n ** 16n; // 0.01 RBTC
    expect(formatWeiAsRBTC(small)).toBe("0.010000 tRBTC");
  });

  it("formats zero correctly", () => {
    expect(formatWeiAsRBTC(0n)).toBe("0.000000 tRBTC");
  });
});
