import { DEFAULT_SETTINGS, isRecord } from "./storage";

import type { State } from "./types";

const map = <T>(v: unknown): Record<string, T> => (isRecord(v) ? (v as Record<string, T>) : {});

// The popup and the service worker can come from different builds (an
// unpacked extension rebuilt but not yet reloaded), so never trust the worker
// to have sent every field.
export const normalizeState = (raw: Partial<State> | null | undefined): State => {
  const r = raw ?? {};
  return {
    activeRuns: map(r.activeRuns),
    lastRuns: map(r.lastRuns),
    lastCounts: map(r.lastCounts),
    stats: {
      clipsByStore: map<number>(r.stats?.clipsByStore),
      savingsByStore: map<number>(r.stats?.savingsByStore),
    },
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    signedOutTabs: map(r.signedOutTabs),
    loadResults: map(r.loadResults),
  };
};
