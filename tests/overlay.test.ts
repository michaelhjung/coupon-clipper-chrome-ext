import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOverlay, showSignInBanner } from "../src/content/overlay";
import { getStoreByName } from "../src/shared/constants";

describe("overlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders progress, the auto-clip note and a working stop button", () => {
    const onStop = vi.fn();
    const overlay = createOverlay({ autoClip: true, onStop });
    expect(document.body.textContent).toContain("Auto-clip is on");
    overlay.setProgress({ clipped: 3, expired: 0, failed: 1, total: 10 });
    expect(document.getElementById("cc-progress-text")?.textContent).toBe(
      "Clipped 3 / 10 · 1 failed"
    );
    overlay.setProgress({ clipped: 3, expired: 2, failed: 1, total: 10 });
    expect(document.getElementById("cc-progress-text")?.textContent).toBe(
      "Clipped 3 / 10 · 2 expired · 1 failed"
    );
    expect(document.getElementById("cc-bar-fill")?.style.width).toBe("60%");
    document.getElementById("cc-stop")!.click();
    expect(onStop).toHaveBeenCalled();
    overlay.showSummary({
      store: "Safeway",
      trigger: "manual",
      clipped: 9,
      expired: 0,
      failed: 1,
      total: 10,
      status: "done",
    });
    expect(document.body.textContent).toContain("Clipped 9 coupons, 1 failed. Nice!");
    overlay.showSummary({
      store: "Raley's",
      trigger: "manual",
      clipped: 157,
      expired: 12,
      failed: 0,
      total: 169,
      status: "done",
    });
    expect(document.getElementById("cc-phase")?.textContent).toBe(
      "Clipped 157 coupons. Nice! 12 had already expired at Raley's and can't be clipped."
    );
    overlay.showSummary({
      store: "Raley's",
      trigger: "manual",
      clipped: 0,
      expired: 12,
      failed: 0,
      total: 12,
      status: "done",
    });
    expect(document.getElementById("cc-phase")?.textContent).toBe(
      "Nothing new to clip. All 12 remaining offers had already expired at Raley's."
    );
    overlay.showSummary({
      store: "Raley's",
      trigger: "manual",
      clipped: 0,
      expired: 12,
      failed: 2,
      total: 14,
      status: "done",
    });
    expect(document.getElementById("cc-phase")?.textContent).toBe(
      "Clipped 0 coupons, 2 failed. 12 had already expired at Raley's and can't be clipped."
    );
    overlay.remove();
    expect(document.getElementById("cc-overlay")).toBeNull();
  });

  it("omits the auto-clip note for manual runs", () => {
    createOverlay({ autoClip: false, onStop: () => undefined });
    expect(document.body.textContent).not.toContain("Auto-clip is on");
  });

  it("shows a dismissible sign-in banner once", () => {
    const safeway = getStoreByName("Safeway")!;
    showSignInBanner(safeway);
    showSignInBanner(safeway);
    expect(document.querySelectorAll("#cc-signin").length).toBe(1);
    document.getElementById("cc-signin-dismiss")!.click();
    expect(document.getElementById("cc-signin")).toBeNull();
  });
});
