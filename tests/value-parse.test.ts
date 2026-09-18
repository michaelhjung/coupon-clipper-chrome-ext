import { describe, expect, it } from "vitest";

import { parseCouponValueCents } from "../src/shared/value-parse";

describe("parseCouponValueCents", () => {
  it("parses flat dollar-off values", () => {
    expect(parseCouponValueCents("$1.00 OFF")).toBe(100);
    expect(parseCouponValueCents("SAVE $2.50")).toBe(250);
    expect(parseCouponValueCents("$5 off $25")).toBe(500);
    expect(parseCouponValueCents("$0.50 off 2")).toBe(50);
    expect(parseCouponValueCents("  Save $3 when you buy 2 ")).toBe(300);
  });

  it("values the saving, not the spend threshold", () => {
    expect(parseCouponValueCents("Spend $50, get $10 off")).toBe(1000);
    expect(parseCouponValueCents("Spend $30, save $5")).toBe(500);
    expect(parseCouponValueCents("$10 off when you spend $50")).toBe(1000);
    expect(parseCouponValueCents("Buy 2, get $1 back")).toBe(100);
  });

  it("returns null for percent, BOGO, free and unparseable text", () => {
    expect(parseCouponValueCents("20% OFF")).toBeNull();
    expect(parseCouponValueCents("Buy 1 Get 1 Free")).toBeNull();
    expect(parseCouponValueCents("FREE")).toBeNull();
    expect(parseCouponValueCents("Save 20% up to $5")).toBeNull();
    expect(parseCouponValueCents("")).toBeNull();
    expect(parseCouponValueCents("$")).toBeNull();
  });
});
