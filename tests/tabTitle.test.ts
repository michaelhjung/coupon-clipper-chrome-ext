import { describe, expect, it } from "vitest";

import { restoreTitle, restoreTitleWhenVisible, setTitlePrefix } from "../src/content/tabTitle";

describe("tabTitle", () => {
  it("prefixes and restores the original title", () => {
    document.title = "Safeway Coupons";
    setTitlePrefix("✂️ 1/10");
    expect(document.title).toBe("✂️ 1/10 · Safeway Coupons");
    setTitlePrefix("✂️ 2/10");
    expect(document.title).toBe("✂️ 2/10 · Safeway Coupons");
    restoreTitle();
    expect(document.title).toBe("Safeway Coupons");
  });
});

describe("restoreTitleWhenVisible", () => {
  const setVisibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    Object.defineProperty(document, "hidden", { value: state === "hidden", configurable: true });
  };

  it("restores immediately when the tab is already visible", () => {
    setVisibility("visible");
    document.title = "Safeway Coupons";
    setTitlePrefix("✅ Done");
    restoreTitleWhenVisible();
    expect(document.title).toBe("Safeway Coupons");
  });

  it("keeps the prefix while hidden and restores once the tab is shown", () => {
    setVisibility("hidden");
    document.title = "Safeway Coupons";
    setTitlePrefix("✅ Done");
    restoreTitleWhenVisible();
    expect(document.title).toBe("✅ Done · Safeway Coupons");
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.title).toBe("Safeway Coupons");
  });
});
