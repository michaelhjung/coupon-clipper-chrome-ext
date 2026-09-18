import { useState } from "react";

import { getCouponPageUrl, getSignInUrl, getStoreByName, STORES } from "../../shared/constants";
import { formatRelativeTime } from "../../shared/format";
import { sendToWorker } from "../../shared/messages";
import { setSettings } from "../../shared/storage";

import type { PendingTask } from "./PopupOverlay";
import type { RunKind, State } from "../../shared/types";
import type { ActiveTabInfo } from "../useActiveTab";

interface Props {
  info: ActiveTabInfo;
  state: State;
  onPending: (task: PendingTask | null) => void;
}

const openInWindow = (url: string, tab: chrome.tabs.Tab | null) =>
  chrome.tabs.create({ url, windowId: tab?.windowId });

export const ContextPanel = ({ info, state, onPending }: Props) => {
  const { tab, store, onCouponPage } = info;
  const tabId = tab?.id;
  const key = tabId !== undefined ? String(tabId) : "";
  const running = Boolean(key && state.activeRuns[key]);
  const signedOutStore = key ? state.signedOutTabs[key] : undefined;
  const lastCount = store ? state.lastCounts[store.name] : undefined;
  const loadResult = key ? state.loadResults[key] : undefined;
  const [selected, setSelected] = useState(state.settings.lastStore ?? "");

  const start = async (kind: RunKind, type: "LOAD_ALL" | "COUNT" | "CLIP_ALL") => {
    if (tabId === undefined) return;
    onPending({ kind, at: Date.now() });
    const reply = await sendToWorker<{ ok: boolean }>({ type, tabId });
    if (!reply?.ok) onPending(null); // the tab is busy or has no content script
  };

  if (store && onCouponPage && tabId !== undefined) {
    return (
      <div className="card w-full">
        <p className="text-sm">
          <span className="mr-1 text-emerald-500">●</span>On <strong>{store.name}</strong>{" "}
          coupons
        </p>
        {signedOutStore && (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-amber-500">Sign in required</span>
            <button className="text-sm" onClick={() => openInWindow(getSignInUrl(store), tab)}>
              Sign in
            </button>
          </div>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            className="min-h-11 px-2 text-sm"
            disabled={running}
            onClick={() => void start("load", "LOAD_ALL")}
          >
            Load All
          </button>
          <button
            className="min-h-11 px-2 text-sm"
            disabled={running}
            onClick={() => void start("count", "COUNT")}
          >
            Count
          </button>
          <button
            className="primary min-h-11 px-2 text-sm"
            disabled={running}
            onClick={() => void start("clip", "CLIP_ALL")}
          >
            Clip All
          </button>
        </div>
        {lastCount && (
          <p className="muted mt-2 text-sm">
            {lastCount.count} coupon{lastCount.count === 1 ? "" : "s"} available to clip ·{" "}
            {formatRelativeTime(lastCount.at)}
          </p>
        )}
        {loadResult !== undefined && <p className="muted mt-2 text-sm">All coupons loaded.</p>}
      </div>
    );
  }

  if (store) {
    return (
      <div className="card w-full">
        <p className="text-sm">
          On <strong>{store.name}</strong>, but not the coupons page.
        </p>
        <button
          className="primary mt-3 w-full"
          onClick={() => openInWindow(getCouponPageUrl(store), tab)}
        >
          Go to {store.name} coupons
        </button>
      </div>
    );
  }

  return (
    <div className="card w-full">
      <p className="muted text-sm">Not on a supported store.</p>
      <div className="mt-2 flex items-center gap-2">
        <select
          className="min-w-0 flex-1 rounded-md border border-slate-500/30 bg-transparent p-2"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            void setSettings({ lastStore: e.target.value || null });
          }}
        >
          <option value="">Select a store</option>
          {STORES.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          disabled={!selected}
          onClick={() => {
            const s = getStoreByName(selected);
            if (s) void openInWindow(getCouponPageUrl(s), tab);
          }}
        >
          Go
        </button>
      </div>
    </div>
  );
};
