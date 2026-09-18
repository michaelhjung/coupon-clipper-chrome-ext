import { beforeEach, describe, expect, it } from "vitest";

import { resetChromeMock } from "./setup";
import { claimAutoClip, releaseAutoClip } from "../src/background/autoClip";
import { AUTO_CLIP_COOLDOWN_MS } from "../src/shared/constants";
import { getCooldowns, setCooldown, setSettings } from "../src/shared/storage";

import type { ActiveRun } from "../src/shared/types";

const run = (store: string): ActiveRun => ({
  store,
  kind: "clip",
  phase: "clipping",
  clipped: 0,
  expired: 0,
  failed: 0,
  total: 0,
  delayMs: 250,
});

const noRuns = async () => ({});

describe("claimAutoClip", () => {
  beforeEach(async () => {
    resetChromeMock();
    await setSettings({ autoClip: true });
  });

  it("refuses when auto-clip is off", async () => {
    await setSettings({ autoClip: false });
    expect(await claimAutoClip("Safeway", noRuns)).toEqual({ ok: false });
  });

  it("grants the first tab and refuses a second tab asking for the same store", async () => {
    const [first, second] = await Promise.all([
      claimAutoClip("Safeway", noRuns),
      claimAutoClip("Safeway", noRuns),
    ]);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false });
    expect(await claimAutoClip("Vons", noRuns)).toEqual({ ok: true });
  });

  it("refuses while any tab is running on the store, even before its cooldown exists", async () => {
    const running = async () => ({ "7": run("Safeway"), "9": run("Vons") });
    expect(await claimAutoClip("Safeway", running)).toEqual({ ok: false });
    expect(await claimAutoClip("Raley's", running)).toEqual({ ok: true });
  });

  it("honours a cooldown left by a finished run and grants again once it lapses", async () => {
    await setCooldown("Safeway", Date.now() - AUTO_CLIP_COOLDOWN_MS + 60_000);
    expect(await claimAutoClip("Safeway", noRuns)).toEqual({ ok: false });
    await setCooldown("Safeway", Date.now() - AUTO_CLIP_COOLDOWN_MS);
    expect(await claimAutoClip("Safeway", noRuns)).toEqual({ ok: true });
  });

  it("can be released by a signed-out tab so the next page load asks again", async () => {
    expect(await claimAutoClip("Safeway", noRuns)).toEqual({ ok: true });
    await releaseAutoClip("Safeway");
    expect((await getCooldowns()).Safeway).toBeUndefined();
    expect(await claimAutoClip("Safeway", noRuns)).toEqual({ ok: true });
  });
});
