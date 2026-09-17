import { describe, expect, it } from "vitest";

import { normalizeState } from "../src/shared/state";
import { DEFAULT_SETTINGS } from "../src/shared/storage";

describe("normalizeState", () => {
  it("fills in maps a stale service worker did not send", () => {
    // A worker from an older build answers GET_STATE without lastCounts.
    const stale = {
      activeRuns: {},
      lastRuns: {},
      stats: { clipsByStore: { Safeway: 3 }, savingsByStore: {} },
      settings: DEFAULT_SETTINGS,
      signedOutTabs: {},
      loadResults: { "7": 2 },
    };
    const state = normalizeState(stale);
    expect(state.lastCounts).toEqual({});
    expect(state.loadResults).toEqual({ "7": 2 });
    expect(state.stats.clipsByStore).toEqual({ Safeway: 3 });
  });

  it("returns a complete default state for an empty reply", () => {
    expect(normalizeState({})).toEqual({
      activeRuns: {},
      lastRuns: {},
      lastCounts: {},
      stats: { clipsByStore: {}, savingsByStore: {} },
      settings: DEFAULT_SETTINGS,
      signedOutTabs: {},
      loadResults: {},
    });
  });

  it("merges partial settings over the defaults", () => {
    const state = normalizeState({ settings: { autoClip: true } as never });
    expect(state.settings).toEqual({ ...DEFAULT_SETTINGS, autoClip: true });
  });
});
