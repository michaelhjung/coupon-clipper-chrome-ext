// Sums only flat dollar-off offers. Percent, BOGO and "free" offers cannot be
// valued without knowing what the shopper buys, so they return null.
const DOLLAR = /\$\s?(\d+(?:\.\d{1,2})?)/;

export const parseCouponValueCents = (text: string): number | null => {
  if (!text || text.includes("%")) return null;
  const match = text.match(DOLLAR);
  if (!match) return null;
  const cents = Math.round(parseFloat(match[1]) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
};
