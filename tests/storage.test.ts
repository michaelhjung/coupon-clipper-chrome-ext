import { beforeEach, describe, expect, it } from "vitest";

import { resetChromeMock } from "./setup";
import {
  computeMigration,
  DEFAULT_SETTINGS,
  ensureMigrated,
  getLastCounts,
  getSettings,
  getStats,
  mergeStats,
  normalizeClipDelay,
  pullStatsFromSync,
  recordClip,
  setLastCount,
  setSettings,
} from "../src/shared/storage";

describe("normalizeClipDelay", () => {
  it("clamps, rounds and defaults", () => {
    expect(normalizeClipDelay(-5)).toBe(0);
    expect(normalizeClipDelay(3500)).toBe(3000);
    expect(normalizeClipDelay(249.6)).toBe(250);
    expect(normalizeClipDelay("abc")).toBe(250);
    expect(normalizeClipDelay(undefined)).toBe(250);
  });
});

describe("computeMigration", () => {
  it("maps 1.5 keys onto the 2.0 schema", () => {
    expect(
      computeMigration({
        couponClipTally: { Safeway: 5, Vons: 2 },
        clipRateLimitDelayMs: 500,
        selectedStore: "Vons",
      })
    ).toEqual({
      settings: { clipDelayMs: 500, lastStore: "Vons" },
      stats: { clipsByStore: { Safeway: 5, Vons: 2 }, savingsByStore: {} },
    });
  });
  it("returns empty migration for a fresh install", () => {
    expect(computeMigration({})).toEqual({
      settings: {},
      stats: { clipsByStore: {}, savingsByStore: {} },
    });
  });
  it("returns null when already on schema 2", () => {
    expect(computeMigration({ schemaVersion: 2, couponClipTally: { Safeway: 5 } })).toBeNull();
  });
});

describe("mergeStats", () => {
  it("takes the per-store maximum", () => {
    expect(
      mergeStats(
        { clipsByStore: { Safeway: 10, Vons: 1 }, savingsByStore: { Safeway: 100 } },
        { clipsByStore: { Safeway: 7, Acme: 3 }, savingsByStore: { Safeway: 400, Acme: 50 } }
      )
    ).toEqual({
      clipsByStore: { Safeway: 10, Vons: 1, Acme: 3 },
      savingsByStore: { Safeway: 400, Acme: 50 },
    });
  });
});

describe("accessors", () => {
  beforeEach(() => resetChromeMock());

  it("returns defaults and persists patches", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await setSettings({ autoClip: true, clipDelayMs: 9999 });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, autoClip: true, clipDelayMs: 3000 });
  });

  it("migrates once and records clips", async () => {
    await chrome.storage.local.set({ couponClipTally: { Safeway: 5 } });
    await ensureMigrated();
    await ensureMigrated();
    expect((await getStats()).clipsByStore).toEqual({ Safeway: 5 });
    await recordClip("Safeway", 150);
    await recordClip("Safeway", null);
    expect(await getStats()).toEqual({
      clipsByStore: { Safeway: 7 },
      savingsByStore: { Safeway: 150 },
    });
  });
});

describe("sync across devices", () => {
  beforeEach(() => resetChromeMock());

  it("is on by default: a fresh install merges totals already in sync storage", async () => {
    await chrome.storage.sync.set({
      stats: { clipsByStore: { Safeway: 40 }, savingsByStore: { Safeway: 1200 } },
    });
    await recordClip("Safeway", 100);
    await pullStatsFromSync();
    expect(await getStats()).toEqual({
      clipsByStore: { Safeway: 40 },
      savingsByStore: { Safeway: 1200 },
    });
  });
});

describe("last counts", () => {
  beforeEach(() => resetChromeMock());

  it("keeps the most recent count per store", async () => {
    expect(await getLastCounts()).toEqual({});
    await setLastCount("Safeway", { count: 363, at: 1000 });
    await setLastCount("Vons", { count: 5, at: 2000 });
    await setLastCount("Safeway", { count: 358, at: 3000 });
    expect(await getLastCounts()).toEqual({
      Safeway: { count: 358, at: 3000 },
      Vons: { count: 5, at: 2000 },
    });
  });
});
