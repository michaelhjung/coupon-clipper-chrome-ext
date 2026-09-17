import type { LastCount, LastRun, Settings, Stats } from "./types";

export const MIN_CLIP_DELAY_MS = 0;
export const MAX_CLIP_DELAY_MS = 3000;
export const CLIP_DELAY_STEP_MS = 50;
export const DEFAULT_CLIP_DELAY_MS = 250;

export const KEYS = {
  settings: "settings",
  stats: "stats",
  lastRuns: "lastRuns",
  lastCounts: "lastCounts",
  cooldown: "autoClipCooldown",
  schema: "schemaVersion",
} as const;

// 1.5.x keys, left in place after migration so a rollback still works.
const LEGACY = {
  tally: "couponClipTally",
  delay: "clipRateLimitDelayMs",
  selectedStore: "selectedStore",
} as const;

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  autoClip: false,
  clipDelayMs: DEFAULT_CLIP_DELAY_MS,
  adaptiveBackoff: true,
  showCount: true,
  showSavings: true,
  syncStats: true,
  lastStore: null,
};

export const normalizeClipDelay = (value: unknown): number => {
  const n = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(n)) {
    return DEFAULT_CLIP_DELAY_MS;
  }
  return Math.min(MAX_CLIP_DELAY_MS, Math.max(MIN_CLIP_DELAY_MS, Math.round(n)));
};

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const toNumberMap = (v: unknown): Record<string, number> =>
  isRecord(v)
    ? Object.fromEntries(
        Object.entries(v)
          .map(([k, n]) => [k, Number(n)] as [string, number])
          .filter(([, n]) => Number.isFinite(n) && n > 0)
      )
    : {};

// Rebuilds Stats from anything stored or synced, dropping junk values.
const toStats = (v: unknown): Stats => {
  const r = isRecord(v) ? v : {};
  return { clipsByStore: toNumberMap(r.clipsByStore), savingsByStore: toNumberMap(r.savingsByStore) };
};

export const computeMigration = (
  raw: Record<string, unknown>
): { settings: Partial<Settings>; stats: Stats } | null => {
  if (raw[KEYS.schema] === SCHEMA_VERSION) return null;
  const settings: Partial<Settings> = {};
  if (raw[LEGACY.delay] !== undefined) {
    settings.clipDelayMs = normalizeClipDelay(raw[LEGACY.delay]);
  }
  if (typeof raw[LEGACY.selectedStore] === "string" && raw[LEGACY.selectedStore]) {
    settings.lastStore = raw[LEGACY.selectedStore] as string;
  }
  return {
    settings,
    stats: { clipsByStore: toNumberMap(raw[LEGACY.tally]), savingsByStore: {} },
  };
};

const maxMerge = (a: Record<string, number>, b: Record<string, number>) => {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

export const mergeStats = (a: Stats, b: Stats): Stats => ({
  clipsByStore: maxMerge(a.clipsByStore, b.clipsByStore),
  savingsByStore: maxMerge(a.savingsByStore, b.savingsByStore),
});

const local = () => chrome.storage.local;

export const getSettings = async (): Promise<Settings> => {
  const { [KEYS.settings]: s } = await local().get(KEYS.settings);
  const merged = { ...DEFAULT_SETTINGS, ...(isRecord(s) ? s : {}) } as Settings;
  merged.clipDelayMs = normalizeClipDelay(merged.clipDelayMs);
  return merged;
};

export const setSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const next = { ...(await getSettings()), ...patch };
  next.clipDelayMs = normalizeClipDelay(next.clipDelayMs);
  await local().set({ [KEYS.settings]: next });
  return next;
};

export const getStats = async (): Promise<Stats> => {
  const { [KEYS.stats]: s } = await local().get(KEYS.stats);
  return toStats(s);
};

export const setStats = async (stats: Stats) => local().set({ [KEYS.stats]: stats });

export const resetStats = async () => {
  await setStats({ clipsByStore: {}, savingsByStore: {} });
  await chrome.storage.sync.remove(KEYS.stats).catch(() => undefined);
};

export const recordClip = async (store: string, valueCents: number | null) => {
  const stats = await getStats();
  stats.clipsByStore[store] = (stats.clipsByStore[store] ?? 0) + 1;
  if (valueCents && valueCents > 0) {
    stats.savingsByStore[store] = (stats.savingsByStore[store] ?? 0) + valueCents;
  }
  await setStats(stats);
};

// Per-store maps under one local key: read-merge-write one entry.
const getMap = async <T>(key: string): Promise<Record<string, T>> => {
  const { [key]: m } = await local().get(key);
  return isRecord(m) ? (m as Record<string, T>) : {};
};

const setMapEntry = async <T>(key: string, store: string, value: T) => {
  await local().set({ [key]: { ...(await getMap<T>(key)), [store]: value } });
};

export const getLastRuns = () => getMap<LastRun>(KEYS.lastRuns);
export const setLastRun = (store: string, run: LastRun) => setMapEntry(KEYS.lastRuns, store, run);

export const getLastCounts = () => getMap<LastCount>(KEYS.lastCounts);
export const setLastCount = (store: string, count: LastCount) =>
  setMapEntry(KEYS.lastCounts, store, count);

export const getCooldowns = async (): Promise<Record<string, number>> =>
  toNumberMap(await getMap(KEYS.cooldown));
export const setCooldown = (store: string, at: number) => setMapEntry(KEYS.cooldown, store, at);

export const mirrorStatsToSync = async () => {
  const settings = await getSettings();
  if (!settings.syncStats) return;
  await chrome.storage.sync.set({ [KEYS.stats]: await getStats() }).catch(() => undefined);
};

export const pullStatsFromSync = async () => {
  const settings = await getSettings();
  if (!settings.syncStats) return;
  const remoteItems = await chrome.storage.sync
    .get(KEYS.stats)
    .catch(() => ({}) as Record<string, unknown>);
  const remote = remoteItems[KEYS.stats];
  if (!isRecord(remote)) return;
  await setStats(mergeStats(await getStats(), toStats(remote)));
};

export const ensureMigrated = async () => {
  const raw = await local().get(null);
  const migration = computeMigration(raw);
  if (!migration) return;
  const settings = { ...DEFAULT_SETTINGS, ...migration.settings };
  await local().set({
    [KEYS.settings]: settings,
    [KEYS.stats]: migration.stats,
    [KEYS.schema]: SCHEMA_VERSION,
  });
};
