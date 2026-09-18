import { useEffect, useState } from "react";

import couponClipperLogo from "/imgs/logo_v2.png";

import { ContextPanel } from "./components/ContextPanel";
import { LastRun } from "./components/LastRun";
import { PopupOverlay } from "./components/PopupOverlay";
import { Totals } from "./components/Totals";
import { useActiveTab } from "./useActiveTab";
import { CHROME_EXT_URL } from "../shared/constants";
import { Footer } from "../ui/Footer";
import { useExtensionState } from "../ui/useExtensionState";

import type { PendingTask } from "./components/PopupOverlay";

const version = chrome.runtime.getManifest().version;

export default function App() {
  const info = useActiveTab();
  const state = useExtensionState(info.tab?.id, info.loaded);
  const [pending, setPending] = useState<PendingTask | null>(null);
  const tabId = info.tab?.id;
  const run = tabId !== undefined ? state?.activeRuns[String(tabId)] : undefined;
  const countedAt = info.store ? state?.lastCounts[info.store.name]?.at : undefined;
  const loadResult = tabId !== undefined ? state?.loadResults[String(tabId)] : undefined;

  // Local pending state bridges the gap between the click and the worker's
  // first broadcast; it clears once a run is visible, a result lands, or 10s pass.
  useEffect(() => {
    if (!pending) return;
    const counted = countedAt !== undefined && countedAt >= pending.at;
    if (run || counted || loadResult !== undefined) {
      setPending(null);
      return;
    }
    const t = setTimeout(() => setPending(null), 10_000);
    return () => clearTimeout(t);
  }, [pending, run, countedAt, loadResult]);

  if (!info.loaded || !state) {
    return <div className="muted w-[360px] p-4 text-sm">Loading…</div>;
  }

  return (
    <div className="relative flex w-[360px] max-w-full flex-col items-center p-4">
      {tabId !== undefined && <PopupOverlay run={run} pending={pending} tabId={tabId} />}
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={couponClipperLogo} className="logo" alt="" />
          <div className="text-left">
            <h1 className="text-lg font-semibold leading-tight">Coupon Clipper</h1>
            <a className="text-xs" href={CHROME_EXT_URL} target="_blank" rel="noopener noreferrer">
              v{version}
            </a>
          </div>
        </div>
        <button
          className="text-lg"
          aria-label="Settings"
          title="Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙
        </button>
      </div>

      <div className="mt-3 w-full">
        <ContextPanel info={info} state={state} onPending={setPending} />
      </div>
      <Totals stats={state.stats} settings={state.settings} />
      <LastRun lastRuns={state.lastRuns} />
      <Footer />
    </div>
  );
}
