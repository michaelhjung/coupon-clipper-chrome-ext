import { describe, expect, it, vi } from "vitest";

import { flush } from "./helpers";
import { isRunning, requestStop, runClip, runCount, runLoadAll } from "../src/content/engine";
import { DEFAULT_SETTINGS } from "../src/shared/storage";

import type { StoreAdapter } from "../src/adapters/types";
import type { EngineDeps } from "../src/content/engine";
import type { ClipResult, ContentToWorker, Coupon } from "../src/shared/types";

const store = {
  name: "Safeway",
  url: "safeway.com",
  couponPath: "/x",
  strategy: "albertsons-api" as const,
};

const fakeAdapter = (coupons: Coupon[], results: ClipResult[], signedIn = true): StoreAdapter => {
  let i = 0;
  return {
    store,
    isSignedIn: async () => signedIn,
    loadAll: async () => 0,
    getUnclipped: () => coupons,
    clip: vi.fn(async () => results[i++] ?? "ok"),
    markClipped: vi.fn(),
  };
};

const fakeDeps = () => {
  const sent: ContentToWorker[] = [];
  const overlay = {
    setPhase: vi.fn(),
    setProgress: vi.fn(),
    showSummary: vi.fn(),
    showError: vi.fn(),
    remove: vi.fn(),
  };
  const deps: EngineDeps = {
    send: (m) => {
      sent.push(m);
    },
    createOverlay: vi.fn(() => overlay),
    createBusyOverlay: vi.fn(() => ({ remove: vi.fn() })),
    showSignInBanner: vi.fn(),
    setTitle: vi.fn(),
    restoreTitle: vi.fn(),
    restoreTitleWhenVisible: vi.fn(),
    sleep: async () => undefined,
  };
  return { deps, sent, overlay };
};

const c = (id: string, valueCents: number | null = 100): Coupon => ({ id, name: id, valueCents });

describe("runClip", () => {
  it("clips every coupon, reports progress and a done summary", async () => {
    const { deps, sent } = fakeDeps();
    const adapter = fakeAdapter([c("1"), c("2", null), c("3")], ["ok", "ok", "failed"]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({
      store: "Safeway",
      clipped: 2,
      failed: 1,
      total: 3,
      status: "done",
    });
    expect(sent.filter((m) => m.type === "COUPON_CLIPPED")).toEqual([
      { type: "COUPON_CLIPPED", store: "Safeway", valueCents: 100 },
      { type: "COUPON_CLIPPED", store: "Safeway", valueCents: null },
    ]);
    expect(sent.at(-1)).toEqual({ type: "DONE", summary });
    expect(sent[0]).toEqual({ type: "STARTED", store: "Safeway", trigger: "manual", kind: "clip" });
    expect(adapter.markClipped).toHaveBeenCalledTimes(2);
    expect(isRunning()).toBe(false);
  });

  it("leaves a done title on the tab until the user looks at it", async () => {
    const { deps } = fakeDeps();
    const adapter = fakeAdapter([c("1"), c("2"), c("3")], ["ok", "ok", "failed"]);
    await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(deps.setTitle).toHaveBeenLastCalledWith("✅ Done · 2 clipped · 1 failed");
    expect(deps.setTitle).not.toHaveBeenCalledWith(expect.stringContaining("expired"));
    expect(deps.restoreTitleWhenVisible).toHaveBeenCalledTimes(1);
    expect(deps.restoreTitle).not.toHaveBeenCalled();
  });

  it("leaves a stopped title when the run was stopped", async () => {
    const { deps } = fakeDeps();
    const adapter = fakeAdapter([c("1"), c("2"), c("3")], ["ok", "ok", "ok"]);
    (adapter.clip as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      requestStop();
      return "ok";
    });
    await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(deps.setTitle).toHaveBeenLastCalledWith("⏹ Stopped · 1/3 clipped");
  });

  it("retries a rate-limited coupon with a longer delay and counts it once", async () => {
    const { deps, sent } = fakeDeps();
    const adapter = fakeAdapter([c("1")], ["rate_limited", "ok"]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 1, failed: 0 });
    expect(adapter.clip).toHaveBeenCalledTimes(2);
    // The popup learns the new delay from the next progress report.
    const delays = sent.flatMap((m) => (m.type === "PROGRESS" ? [m.delayMs] : []));
    expect(delays).toEqual([250, 500, 500]);
  });

  it("counts expired coupons apart from failures and does not record them as clipped", async () => {
    const { deps, sent, overlay } = fakeDeps();
    const adapter = fakeAdapter([c("1"), c("2"), c("3"), c("4")], ["ok", "expired", "failed", "expired"]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 1, expired: 2, failed: 1, total: 4, status: "done" });
    expect(sent.filter((m) => m.type === "COUPON_CLIPPED")).toHaveLength(1);
    expect(adapter.markClipped).toHaveBeenCalledTimes(1);
    expect(overlay.setProgress).toHaveBeenLastCalledWith({ clipped: 1, expired: 2, failed: 1, total: 4 });
    expect(sent.filter((m) => m.type === "PROGRESS").at(-1)).toMatchObject({ clipped: 1, expired: 2, failed: 1 });
    expect(deps.setTitle).toHaveBeenLastCalledWith("✅ Done · 1 clipped · 2 expired · 1 failed");
  });

  it("gives up after three rate-limited attempts", async () => {
    const { deps } = fakeDeps();
    const adapter = fakeAdapter([c("1")], ["rate_limited", "rate_limited", "rate_limited"]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 0, failed: 1 });
    expect(adapter.clip).toHaveBeenCalledTimes(3);
  });

  it("reports signin and shows the banner when signed out", async () => {
    const { deps, sent } = fakeDeps();
    const summary = await runClip(
      fakeAdapter([c("1")], [], false),
      "auto",
      DEFAULT_SETTINGS,
      deps
    );
    expect(summary.status).toBe("signin");
    expect(deps.showSignInBanner).toHaveBeenCalled();
    // SIGNED_OUT is the whole story; no STARTED/DONE, so the worker does not
    // notify twice or record a run.
    expect(sent).toEqual([{ type: "SIGNED_OUT", store: "Safeway", trigger: "auto" }]);
    expect(isRunning()).toBe(false);
  });

  it("passes the auto-clip flag to the overlay", async () => {
    const { deps } = fakeDeps();
    await runClip(fakeAdapter([], []), "auto", DEFAULT_SETTINGS, deps);
    expect(deps.createOverlay).toHaveBeenCalledWith(expect.objectContaining({ autoClip: true }));
  });

  it("stops cleanly when requested", async () => {
    const { deps } = fakeDeps();
    const adapter = fakeAdapter([c("1"), c("2"), c("3")], ["ok", "ok", "ok"]);
    (adapter.clip as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      requestStop();
      return "ok";
    });
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 1, status: "stopped" });
  });

  it("refuses a second concurrent run", async () => {
    const { deps } = fakeDeps();
    let release!: () => void;
    const adapter = fakeAdapter([c("1")], []);
    (adapter.clip as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<ClipResult>((r) => (release = () => r("ok")))
    );
    const first = runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    await flush();
    expect(isRunning()).toBe(true);
    const second = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(second.status).toBe("error");
    release();
    await first;
  });

  it("reports an error summary when the adapter throws", async () => {
    const { deps, overlay } = fakeDeps();
    const adapter = fakeAdapter([c("1")], []);
    (adapter.clip as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ status: "error", message: "boom" });
    expect(overlay.showError).toHaveBeenCalledWith("boom");
  });
});

describe("runCount", () => {
  it("reports start, the number of unclipped coupons, then task done", async () => {
    const { deps, sent } = fakeDeps();
    await runCount(fakeAdapter([c("1"), c("2")], []), deps);
    expect(sent.map((m) => m.type)).toEqual(["STARTED", "COUNT_RESULT", "TASK_DONE"]);
    expect(sent[0]).toMatchObject({ type: "STARTED", kind: "count", store: "Safeway" });
    expect(sent).toContainEqual({ type: "COUNT_RESULT", store: "Safeway", count: 2 });
    expect(deps.createBusyOverlay).toHaveBeenCalledWith("Counting coupons…");
    expect(deps.restoreTitle).toHaveBeenCalled();
    expect(isRunning()).toBe(false);
  });

  it("reports signed out without a task", async () => {
    const { deps, sent } = fakeDeps();
    await runCount(fakeAdapter([c("1")], [], false), deps);
    expect(sent.map((m) => m.type)).toEqual(["SIGNED_OUT"]);
  });
});

describe("runLoadAll", () => {
  it("reports start, clicks, then task done", async () => {
    const { deps, sent } = fakeDeps();
    await runLoadAll(fakeAdapter([], []), deps);
    expect(sent.map((m) => m.type)).toEqual(["STARTED", "LOAD_RESULT", "TASK_DONE"]);
    expect(sent[0]).toMatchObject({ type: "STARTED", kind: "load" });
    expect(deps.createBusyOverlay).toHaveBeenCalledWith("Loading all coupons…");
  });
});

describe("API fast path", () => {
  const withApi = (api: Coupon[] | null, dom: Coupon[]) => {
    const adapter = fakeAdapter(dom, ["ok", "ok", "ok"]);
    adapter.loadAll = vi.fn(async () => 0);
    adapter.fetchUnclipped = vi.fn(async () => api);
    return adapter;
  };

  it("runClip clips the API list and never clicks load-more", async () => {
    const { deps } = fakeDeps();
    const adapter = withApi([c("a1"), c("a2")], [c("d1")]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 2, total: 2 });
    expect(adapter.loadAll).not.toHaveBeenCalled();
    expect(adapter.clip).toHaveBeenCalledWith(c("a1"));
  });

  it("runClip falls back to the page when the API returns null", async () => {
    const { deps } = fakeDeps();
    const adapter = withApi(null, [c("d1")]);
    const summary = await runClip(adapter, "manual", DEFAULT_SETTINGS, deps);
    expect(summary).toMatchObject({ clipped: 1, total: 1 });
    expect(adapter.loadAll).toHaveBeenCalledTimes(1);
    expect(adapter.clip).toHaveBeenCalledWith(c("d1"));
  });

  it("runCount counts the API list and never clicks load-more", async () => {
    const { deps, sent } = fakeDeps();
    const adapter = withApi([c("a1"), c("a2"), c("a3")], [c("d1")]);
    await runCount(adapter, deps);
    expect(sent).toContainEqual({ type: "COUNT_RESULT", store: "Safeway", count: 3 });
    expect(adapter.loadAll).not.toHaveBeenCalled();
  });

  it("runCount falls back to the page when the API returns null", async () => {
    const { deps, sent } = fakeDeps();
    const adapter = withApi(null, [c("d1")]);
    await runCount(adapter, deps);
    expect(sent).toContainEqual({ type: "COUNT_RESULT", store: "Safeway", count: 1 });
    expect(adapter.loadAll).toHaveBeenCalledTimes(1);
  });

  it("trusts an empty API list even when stale cards on the page still show clip buttons", async () => {
    // After an API clip run the site keeps rendering cards from its old
    // gallery, so "Clip" buttons on the page do not mean unclipped coupons.
    const { deps, sent } = fakeDeps();
    const adapter = withApi([], [c("stale1"), c("stale2")]);
    await runCount(adapter, deps);
    expect(sent).toContainEqual({ type: "COUNT_RESULT", store: "Safeway", count: 0 });
    expect(adapter.loadAll).not.toHaveBeenCalled();
    expect(adapter.clip).not.toHaveBeenCalled();
  });

  it("runLoadAll always clicks load-more, even when the API is available", async () => {
    const { deps } = fakeDeps();
    const adapter = withApi([c("a1")], []);
    await runLoadAll(adapter, deps);
    expect(adapter.loadAll).toHaveBeenCalledTimes(1);
    expect(adapter.fetchUnclipped).not.toHaveBeenCalled();
  });
});
