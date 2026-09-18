import { describe, expect, it } from "vitest";

import { asString, firstLine } from "../src/shared/text";

describe("asString", () => {
  it("trims strings and stringifies finite numbers", () => {
    expect(asString("  38737 ")).toBe("38737");
    expect(asString(38737)).toBe("38737");
  });

  it("returns an empty string for anything that is not text-like", () => {
    expect(asString(undefined)).toBe("");
    expect(asString(null)).toBe("");
    expect(asString(true)).toBe("");
    expect(asString({ id: 1 })).toBe("");
    expect(asString(NaN)).toBe("");
  });
});

describe("firstLine", () => {
  it("keeps the first line and collapses whitespace", () => {
    expect(firstLine("Save $3 on  ONE Tide\nOffer valid once per household")).toBe("Save $3 on ONE Tide");
    expect(firstLine(undefined)).toBe("");
  });
});
