export type Strategy = "albertsons-api" | "raleys-dom" | "cvs-api";

export interface StoreConfig {
  name: string;
  url: string;
  couponPath: string;
  // Older paths the store still serves the coupon page at.
  altCouponPaths?: string[];
  strategy: Strategy;
  signInPath?: string;
}

export type Trigger = "manual" | "auto";
export type RunStatus = "done" | "stopped" | "signin" | "error";
export type RunPhase = "loading" | "clipping";
export type RunKind = "clip" | "count" | "load";
// "expired": the store's server says the offer is no longer valid even
// though it still lists it; nothing the user or we can do about it.
export type ClipResult = "ok" | "failed" | "rate_limited" | "expired";

export interface Coupon {
  id: string;
  name: string;
  valueCents: number | null;
  pgm?: string; // the store's offer program/type, needed to clip via API
}

export interface RunSummary {
  store: string;
  trigger: Trigger;
  clipped: number;
  expired: number;
  failed: number;
  total: number;
  status: RunStatus;
  message?: string;
}

export interface LastRun extends RunSummary {
  at: number;
}

// Most recent "coupons available to clip" per store, kept until the next
// count or clip run updates it.
export interface LastCount {
  count: number;
  at: number;
}

export interface Settings {
  autoClip: boolean;
  clipDelayMs: number;
  adaptiveBackoff: boolean;
  showCount: boolean;
  showSavings: boolean;
  syncStats: boolean;
  lastStore: string | null;
}

export interface Stats {
  clipsByStore: Record<string, number>;
  savingsByStore: Record<string, number>; // cents
}

export interface ActiveRun {
  store: string;
  kind: RunKind;
  phase: RunPhase;
  clipped: number;
  expired: number;
  failed: number;
  total: number;
  delayMs: number;
}

export interface State {
  activeRuns: Record<string, ActiveRun>; // keyed by tabId
  lastRuns: Record<string, LastRun>; // keyed by store name
  lastCounts: Record<string, LastCount>; // keyed by store name
  stats: Stats;
  settings: Settings;
  signedOutTabs: Record<string, string>; // tabId -> store name
  loadResults: Record<string, number>; // tabId -> load-more clicks
}

export type ContentToWorker =
  | { type: "CONTENT_READY" }
  | { type: "SIGNED_OUT"; store: string; trigger: Trigger }
  | { type: "STARTED"; store: string; trigger: Trigger; kind: RunKind }
  | {
      type: "PROGRESS";
      phase: RunPhase;
      clipped: number;
      expired: number;
      failed: number;
      total: number;
      delayMs: number;
    }
  | { type: "COUPON_CLIPPED"; store: string; valueCents: number | null }
  | { type: "DONE"; summary: RunSummary }
  | { type: "TASK_DONE" }
  | { type: "COUNT_RESULT"; store: string; count: number }
  | { type: "LOAD_RESULT"; clicks: number }
  | { type: "SHOULD_AUTO_CLIP"; store: string }
  | { type: "LOG"; line: string };

export type UiToWorker =
  | { type: "CLIP_ALL"; tabId: number }
  | { type: "COUNT"; tabId: number }
  | { type: "LOAD_ALL"; tabId: number }
  | { type: "STOP"; tabId: number }
  | { type: "GET_STATE"; tabId?: number }
  | { type: "GET_LOGS" };

export type WorkerToContent =
  | { type: "CLIP_ALL"; trigger: Trigger }
  | { type: "COUNT" }
  | { type: "LOAD_ALL" }
  | { type: "STOP" };

export type WorkerToUi = { type: "STATE"; state: State };
