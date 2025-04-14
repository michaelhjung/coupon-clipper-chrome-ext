export const generateUUID = (a?: string | number, c?: string): string => {
  const timestamp = Date.now(); // Current time in ms
  let seed = Math.floor(performance.now() * timestamp); // Seed with performance + timestamp

  // If 'a' is a number or numeric string, add it to the seed
  if (a && !isNaN(Number(a))) {
    seed += Number(a);
  }

  // If 'c' is provided, encode it and add it to the seed
  if (c && typeof c === "string" && c.length > 0) {
    seed += encodeStringToNumber(c);
  }

  // Generate UUID using seeded randomness
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (seed + Math.random() * 16) % 16 | 0;
    seed = Math.floor(seed / 16);
    return (char === "x" ? rand : (rand & 0x3) | 0x8).toString(16);
  });
};

// Helper: basic string-to-number encoding
const encodeStringToNumber = (str: string): number => {
  let encoded = 0;
  for (let i = 0; i < str.length; i++) {
    encoded += str.charCodeAt(i) * (i + 1);
  }
  return encoded;
};
