// Coercions for values read out of untyped API bodies and page globals.

// Trimmed string for strings and numbers; anything else is "".
export const asString = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
};

// First line with whitespace collapsed; stores put legal text after a newline.
export const firstLine = (v: unknown): string =>
  asString(v).split("\n")[0].replace(/\s+/g, " ").trim();
