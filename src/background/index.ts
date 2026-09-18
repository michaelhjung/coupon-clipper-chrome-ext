import { claimAutoClip, releaseAutoClip } from "./autoClip";
import { summaryMessage } from "../shared/format";
import { appendLog, errorMessage, getLogs, log } from "../shared/log";
import { broadcast, sendToTab } from "../shared/messages";
import {
  ensureMigrated,
  getLastCounts,
  getLastRuns,
  getSettings,
  getStats,
  mirrorStatsToSync,
  pullStatsFromSync,
  recordClip,
  setCooldown,
  setLastCount,
  setLastRun,
} from "../shared/storage";

import type {
  ActiveRun,
  ContentToWorker,
  State,
  UiToWorker,
  WorkerToContent,
} from "../shared/types";

type SessionMaps = {
  activeRuns: Record<string, ActiveRun>;
  signedOutTabs: Record<string, string>;
  loadResults: Record<string, number>;
};
const SESSION_KEYS: (keyof SessionMaps)[] = [
  "activeRuns",
  "signedOutTabs",
  "loadResults",
];

const session = () => chrome.storage.session;

const getMap = async <K extends keyof SessionMaps>(key: K): Promise<SessionMaps[K]> => {
  const { [key]: v } = await session().get(key);
  return (v ?? {}) as SessionMaps[K];
};

const patchMap = async <K extends keyof SessionMaps>(
  key: K,
  tabId: number,
  value: SessionMaps[K][string] | null
) => {
  const map = { ...(await getMap(key)) } as Record<string, unknown>;
  if (value === null) delete map[String(tabId)];
  else map[String(tabId)] = value;
  await session().set({ [key]: map });
};

const updateRun = async (tabId: number, patch: Partial<ActiveRun>) => {
  const run = (await getMap("activeRuns"))[String(tabId)];
  if (run) await patchMap("activeRuns", tabId, { ...run, ...patch });
};

const buildState = async (): Promise<State> => {
  const [activeRuns, signedOutTabs, loadResults, lastRuns, lastCounts, stats, settings] =
    await Promise.all([
      getMap("activeRuns"),
      getMap("signedOutTabs"),
      getMap("loadResults"),
      getLastRuns(),
      getLastCounts(),
      getStats(),
      getSettings(),
    ]);
  return {
    activeRuns,
    signedOutTabs,
    loadResults,
    lastRuns,
    lastCounts,
    stats,
    settings,
  };
};

// Coalesces the bursts a run produces (a content message plus the storage
// change it causes) into one state read and one broadcast.
const BROADCAST_DEBOUNCE_MS = 50;
let broadcastTimer: ReturnType<typeof setTimeout> | undefined;
const broadcastState = () => {
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    void buildState().then((state) => broadcast({ type: "STATE", state }));
  }, BROADCAST_DEBOUNCE_MS);
};

const setBadge = async (tabId: number, text: string, color = "#4caf50") => {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
  } catch {
    /* tab gone */
  }
};

const notify = async (tabId: number, message: string) => {
  try {
    await chrome.notifications.create(`run-${tabId}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Coupon Clipper",
      message,
    });
  } catch {
    /* notifications unavailable */
  }
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleSyncMirror = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void mirrorStatsToSync(), 2000);
};

const handleContent = async (msg: ContentToWorker, tabId: number): Promise<unknown> => {
  switch (msg.type) {
    case "CONTENT_READY":
      // A fresh content script means any run this tab was reporting is gone.
      await patchMap("activeRuns", tabId, null);
      break;
    case "SHOULD_AUTO_CLIP":
      return claimAutoClip(msg.store, () => getMap("activeRuns"));
    case "SIGNED_OUT":
      log.info(`tab ${tabId} signed out of ${msg.store} (${msg.trigger})`);
      await patchMap("signedOutTabs", tabId, msg.store);
      await setBadge(tabId, "!", "#ff4d4f");
      if (msg.trigger === "auto") {
        await releaseAutoClip(msg.store);
        await notify(tabId, `Sign in to ${msg.store} to clip coupons`);
      }
      break;
    case "STARTED": {
      const { clipDelayMs } = await getSettings();
      await Promise.all([
        patchMap("signedOutTabs", tabId, null),
        patchMap("activeRuns", tabId, {
          store: msg.store,
          kind: msg.kind,
          phase: "loading",
          clipped: 0,
          expired: 0,
          failed: 0,
          total: 0,
          delayMs: clipDelayMs,
        }),
        setBadge(tabId, "…", "#3c8fc3"),
      ]);
      break;
    }
    case "PROGRESS": {
      const { phase, clipped, expired, failed, total, delayMs } = msg;
      await updateRun(tabId, { phase, clipped, expired, failed, total, delayMs });
      break;
    }
    case "COUPON_CLIPPED":
      await recordClip(msg.store, msg.valueCents);
      scheduleSyncMirror();
      return;
    case "DONE": {
      const s = msg.summary;
      log.info(`run done on tab ${tabId}: ${JSON.stringify(s)}`);
      await patchMap("activeRuns", tabId, null);
      await setLastRun(s.store, { ...s, at: Date.now() });
      // Whatever was not clipped is still available, except offers the store
      // itself reported as expired: they cannot be clipped by anyone.
      if (s.status !== "error") {
        await setLastCount(s.store, { count: s.total - s.clipped - s.expired, at: Date.now() });
      }
      await setCooldown(s.store, Date.now());
      await setBadge(tabId, String(s.clipped));
      clearTimeout(syncTimer); // mirror once, now, instead of again in 2s
      await mirrorStatsToSync();
      if (s.trigger === "auto") await notify(tabId, summaryMessage(s));
      break;
    }
    case "TASK_DONE":
      await patchMap("activeRuns", tabId, null);
      await setBadge(tabId, "");
      break;
    case "COUNT_RESULT":
      log.info(`count result for ${msg.store}: ${msg.count}`);
      await setLastCount(msg.store, { count: msg.count, at: Date.now() });
      break;
    case "LOAD_RESULT":
      await patchMap("loadResults", tabId, msg.clicks);
      break;
    case "LOG":
      await appendLog(msg.line);
      return;
  }
  broadcastState();
  return undefined;
};

// The tab answers { ok: false } when it is already busy; no answer means the
// page has no content script (loaded before the extension was installed).
const forwardToTab = async (tabId: number, msg: WorkerToContent) =>
  (await sendToTab<{ ok: boolean }>(tabId, msg)) ?? { ok: false };

const handleUi = async (msg: UiToWorker): Promise<unknown> => {
  switch (msg.type) {
    case "GET_STATE":
      if (msg.tabId !== undefined) {
        await setBadge(msg.tabId, "");
        await patchMap("loadResults", msg.tabId, null);
      }
      return buildState();
    case "GET_LOGS":
      return getLogs();
    case "CLIP_ALL":
      return forwardToTab(msg.tabId, { type: "CLIP_ALL", trigger: "manual" });
    case "COUNT":
      return forwardToTab(msg.tabId, { type: "COUNT" });
    case "LOAD_ALL":
      return forwardToTab(msg.tabId, { type: "LOAD_ALL" });
    case "STOP":
      return forwardToTab(msg.tabId, { type: "STOP" });
  }
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const work =
    tabId !== undefined
      ? handleContent(msg as ContentToWorker, tabId)
      : handleUi(msg as UiToWorker);
  work.then(sendResponse).catch((err) => {
    void appendLog(`ERROR worker: ${errorMessage(err)}`);
    sendResponse(undefined);
  });
  return true; // async response
});

const restoreStats = () => void ensureMigrated().then(pullStatsFromSync);
chrome.runtime.onInstalled.addListener(restoreStats);
chrome.runtime.onStartup.addListener(restoreStats);

// Let content scripts write to session storage (log buffer).
void chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local" || area === "sync") broadcastState();
});

// Forget a closed tab, touching only the maps that mention it.
chrome.tabs.onRemoved.addListener((tabId) => {
  void session()
    .get(SESSION_KEYS)
    .then(async (maps) => {
      const stale = SESSION_KEYS.filter((k) => String(tabId) in (maps[k] ?? {}));
      if (stale.length === 0) return;
      await Promise.all(stale.map((k) => patchMap(k, tabId, null)));
      broadcastState();
    });
});

chrome.notifications.onClicked.addListener((id) => {
  const tabId = Number(id.split("-")[1]);
  if (!Number.isFinite(tabId)) return;
  chrome.tabs
    .update(tabId, { active: true })
    .then((tab) => {
      if (tab?.windowId !== undefined) void chrome.windows.update(tab.windowId, { focused: true });
    })
    .catch(() => undefined);
});
