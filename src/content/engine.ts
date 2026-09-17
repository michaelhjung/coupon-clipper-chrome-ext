import { sleep } from "./loadMore";
import { createBusyOverlay, createOverlay, showSignInBanner } from "./overlay";
import { restoreTitle, restoreTitleWhenVisible, setTitlePrefix } from "./tabTitle";
import { createBackoff, MAX_ATTEMPTS, onFailed, onOk, onRateLimited } from "../shared/backoff";
import { finishedTitle } from "../shared/format";
import { errorMessage, log } from "../shared/log";
import { sendToWorker } from "../shared/messages";

import type { OverlayHandle } from "./overlay";
import type { StoreAdapter } from "../adapters/types";
import type {
  ClipResult,
  ContentToWorker,
  Coupon,
  RunStatus,
  RunSummary,
  Settings,
  Trigger,
} from "../shared/types";

export interface EngineDeps {
  send(msg: ContentToWorker): void;
  createOverlay: typeof createOverlay;
  createBusyOverlay: typeof createBusyOverlay;
  showSignInBanner: typeof showSignInBanner;
  setTitle(prefix: string): void;
  restoreTitle(): void;
  restoreTitleWhenVisible(): void;
  sleep(ms: number): Promise<void>;
}

const defaultDeps: EngineDeps = {
  send: (msg) => void sendToWorker(msg),
  createOverlay,
  createBusyOverlay,
  showSignInBanner,
  setTitle: setTitlePrefix,
  restoreTitle,
  restoreTitleWhenVisible,
  sleep,
};

const SUMMARY_LINGER_MS = 1500;

// Prefer the store API when the adapter offers one; otherwise (or if it
// fails) expand the page with "load more" and read the DOM.
const collectUnclipped = async (
  adapter: StoreAdapter,
  onFallback: () => void
): Promise<{ coupons: Coupon[]; source: "api" | "dom" }> => {
  // The API is the source of truth: after an API clip run the page keeps
  // rendering cards from its stale gallery, so "Clip" buttons on the page do
  // not mean unclipped coupons. Only fall back when the API itself fails.
  if (adapter.fetchUnclipped) {
    const coupons = await adapter.fetchUnclipped();
    if (coupons) return { coupons, source: "api" };
    log.warn("offers api unavailable, falling back to load-more + page scan");
  }
  onFallback();
  const started = Date.now();
  const clicks = await adapter.loadAll();
  const coupons = adapter.getUnclipped();
  log.info(`page scan: ${coupons.length} unclipped after ${clicks} load-more clicks in ${Date.now() - started}ms`);
  return { coupons, source: "dom" };
};

let current: { stopRequested: boolean } | null = null;

export const isRunning = () => current !== null;

export const requestStop = () => {
  if (current) current.stopRequested = true;
};

// Shows the banner and tells the worker; the caller does nothing else.
const ensureSignedIn = async (adapter: StoreAdapter, trigger: Trigger, deps: EngineDeps) => {
  if (await adapter.isSignedIn()) return true;
  log.warn(`not signed in on ${adapter.store.name}; ${trigger} run skipped`);
  deps.showSignInBanner(adapter.store);
  deps.send({ type: "SIGNED_OUT", store: adapter.store.name, trigger });
  return false;
};

export const runClip = async (
  adapter: StoreAdapter,
  trigger: Trigger,
  settings: Settings,
  deps: EngineDeps = defaultDeps
): Promise<RunSummary> => {
  const store = adapter.store.name;
  const base = { store, trigger, clipped: 0, expired: 0, failed: 0, total: 0 };
  if (current) {
    return { ...base, status: "error", message: "A run is already in progress" };
  }
  const run = { stopRequested: false };
  current = run;
  let ui: OverlayHandle | null = null;

  const finish = (summary: RunSummary) => {
    deps.send({ type: "DONE", summary });
    current = null;
    return summary;
  };

  try {
    if (!(await ensureSignedIn(adapter, trigger, deps))) {
      current = null;
      return { ...base, status: "signin" };
    }

    ui = deps.createOverlay({ autoClip: trigger === "auto", onStop: requestStop });
    deps.send({ type: "STARTED", store, trigger, kind: "clip" });
    deps.setTitle("✂️ Loading…");
    ui.setPhase("Finding coupons…");

    const { coupons, source } = await collectUnclipped(adapter, () =>
      ui?.setPhase("Loading all coupons…")
    );
    const total = coupons.length;
    log.info(`clip run (${trigger}) on ${store}: ${total} to clip via ${source}, delay ${settings.clipDelayMs}ms`);
    let clipped = 0;
    let expired = 0;
    let failed = 0;
    let backoff = createBackoff(settings.clipDelayMs, settings.adaptiveBackoff);
    let status: RunStatus = "done";

    const progress = () => {
      ui?.setProgress({ clipped, expired, failed, total });
      deps.setTitle(`✂️ ${clipped}/${total}`);
      deps.send({
        type: "PROGRESS",
        phase: "clipping",
        clipped,
        expired,
        failed,
        total,
        delayMs: backoff.delayMs,
      });
    };
    ui.setPhase("Clipping in progress… please don't refresh the page.");
    progress();

    for (const coupon of coupons) {
      if (run.stopRequested) {
        status = "stopped";
        log.info(
          `stop requested: ${clipped} clipped, ${expired} expired, ${failed} failed, ` +
            `${total - clipped - expired - failed} left`
        );
        break;
      }
      const started = Date.now();
      let result: ClipResult = "failed";
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        result = await adapter.clip(coupon);
        if (result !== "rate_limited") break;
        log.warn(`rate limited on "${coupon.name}" (attempt ${attempt})`);
        backoff = onRateLimited(backoff);
        progress(); // the popup shows the current delay
        await deps.sleep(backoff.delayMs);
      }
      const detail = `"${coupon.name}" id=${coupon.id} pgm=${coupon.pgm ?? "?"} in ${Date.now() - started}ms`;
      if (result === "ok") {
        clipped++;
        adapter.markClipped(coupon);
        deps.send({ type: "COUPON_CLIPPED", store, valueCents: coupon.valueCents });
        backoff = onOk(backoff);
        log.info(`clipped ${clipped}/${total} ${detail}`);
      } else if (result === "expired") {
        // The store already dropped this offer; not a failure on our side.
        expired++;
        log.info(`expired, skipping ${detail}`);
      } else {
        failed++;
        log.warn(`failed to clip ${detail}`);
        backoff = onFailed(backoff);
      }
      progress();
      await deps.sleep(backoff.delayMs);
    }

    const summary: RunSummary = { store, trigger, clipped, expired, failed, total, status };
    log.info(`clip run finished: ${JSON.stringify(summary)}`);
    ui.showSummary(summary);
    deps.setTitle(finishedTitle(summary));
    await deps.sleep(SUMMARY_LINGER_MS);
    ui.remove();
    deps.restoreTitleWhenVisible();
    return finish(summary);
  } catch (err) {
    const message = errorMessage(err);
    log.error("clip run failed:", err);
    ui?.showError(message);
    deps.restoreTitle();
    return finish({ ...base, status: "error", message });
  }
};

// Count and Load All share one "busy" flow: STARTED → work → TASK_DONE.
const runTask = async (
  adapter: StoreAdapter,
  kind: "count" | "load",
  text: string,
  deps: EngineDeps,
  work: () => Promise<void>
) => {
  if (current) return;
  current = { stopRequested: false };
  const busy = deps.createBusyOverlay(text);
  deps.send({ type: "STARTED", store: adapter.store.name, trigger: "manual", kind });
  deps.setTitle(`✂️ ${text}`);
  try {
    await work();
  } catch (err) {
    log.error(`${kind} failed:`, err);
  } finally {
    busy.remove();
    deps.restoreTitle();
    deps.send({ type: "TASK_DONE" });
    current = null;
  }
};

export const runCount = async (adapter: StoreAdapter, deps: EngineDeps = defaultDeps) => {
  if (!(await ensureSignedIn(adapter, "manual", deps))) return;
  await runTask(adapter, "count", "Counting coupons…", deps, async () => {
    const started = Date.now();
    const { coupons, source } = await collectUnclipped(adapter, () => undefined);
    log.info(`count on ${adapter.store.name}: ${coupons.length} unclipped via ${source} in ${Date.now() - started}ms`);
    deps.send({ type: "COUNT_RESULT", store: adapter.store.name, count: coupons.length });
  });
};

export const runLoadAll = async (adapter: StoreAdapter, deps: EngineDeps = defaultDeps) => {
  await runTask(adapter, "load", "Loading all coupons…", deps, async () => {
    const started = Date.now();
    const clicks = await adapter.loadAll();
    log.info(`load all on ${adapter.store.name}: ${clicks} load-more clicks in ${Date.now() - started}ms`);
    deps.send({ type: "LOAD_RESULT", clicks });
  });
};
