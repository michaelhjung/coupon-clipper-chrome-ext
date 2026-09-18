// Sums only flat dollar-off offers. Percent, BOGO and "free" offers cannot be
// valued without knowing what the shopper buys, so they return null.
const AMOUNT = String.raw`\$\s?(\d+(?:\.\d{1,2})?)`;

// Ordered by how surely the amount is the saving rather than a spend
// threshold: "Spend $50, get $10 off" is worth $10, not $50.
const SAVINGS_PATTERNS = [
  new RegExp(String.raw`${AMOUNT}\s*off\b`, "i"),
  new RegExp(String.raw`\b(?:save|get)\s*${AMOUNT}`, "i"),
  new RegExp(AMOUNT),
];

const findSavings = (text: string): string | null => {
  for (const pattern of SAVINGS_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const parseCouponValueCents = (text: string): number | null => {
  if (!text || text.includes("%")) return null;
  const amount = findSavings(text);
  if (amount === null) return null;
  const cents = Math.round(parseFloat(amount) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
};
