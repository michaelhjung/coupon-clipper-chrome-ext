import { describe, expect, it } from "vitest";

import { formatCount, formatDollars, formatRelativeTime } from "../src/shared/format";

describe("formatCount", () => {
  it("uses commas below 100k", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(12432)).toBe("12,432");
    expect(formatCount(99999)).toBe("99,999");
  });
  it("uses compact notation at 100k and above", () => {
    expect(formatCount(100000)).toBe("100k");
    expect(formatCount(124300)).toBe("124.3k");
    expect(formatCount(1200000)).toBe("1.2M");
  });
});

describe("formatDollars", () => {
  it("shows cents under $100", () => {
    expect(formatDollars(0)).toBe("$0.00");
    expect(formatDollars(4150)).toBe("$41.50");
    expect(formatDollars(9999)).toBe("$99.99");
  });
  it("drops cents and adds commas at $100 and above", () => {
    expect(formatDollars(10000)).toBe("$100");
    expect(formatDollars(124000)).toBe("$1,240");
    expect(formatDollars(124050)).toBe("$1,241");
  });
});

describe("formatRelativeTime", () => {
  const now = 1_000_000_000_000;
  it("formats seconds, minutes, hours, days", () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 3 * 60_000, now)).toBe("3 min ago");
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2 hr ago");
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
});
