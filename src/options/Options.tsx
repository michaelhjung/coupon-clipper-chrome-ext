import { useState } from "react";

import { Section } from "./components/Section";
import { Toggle } from "./components/Toggle";
import { sendToWorker } from "../shared/messages";
import {
  CLIP_DELAY_STEP_MS,
  DEFAULT_CLIP_DELAY_MS,
  MAX_CLIP_DELAY_MS,
  MIN_CLIP_DELAY_MS,
  resetStats,
  setSettings,
} from "../shared/storage";
import { Footer } from "../ui/Footer";
import { useExtensionState } from "../ui/useExtensionState";

const version = chrome.runtime.getManifest().version;

export default function Options() {
  const state = useExtensionState();
  const [copied, setCopied] = useState(false);
  if (!state) return <div className="muted p-6 text-sm">Loading…</div>;
  const s = state.settings;

  const copyDebugInfo = async () => {
    const logs = (await sendToWorker<string[]>({ type: "GET_LOGS" })) ?? [];
    const text = [
      `Coupon Clipper v${version}`,
      `Settings: ${JSON.stringify(s)}`,
      `Last runs: ${JSON.stringify(state.lastRuns)}`,
      "",
      ...logs,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[640px] p-6">
      <h1 className="text-2xl font-semibold">Coupon Clipper settings</h1>

      <Section title="Auto-clip">
        <Toggle
          label="Clip automatically when I open a coupon page"
          description="When you open a supported store's coupon page while signed in, Coupon Clipper clips everything automatically. It waits 30 minutes before running again on the same store. You'll see progress on the page and get a notification when it's done."
          checked={s.autoClip}
          onChange={(autoClip) => void setSettings({ autoClip })}
        />
      </Section>

      <Section title="Clip delay">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {s.adaptiveBackoff ? "Starting delay" : "Delay"} between coupons
            </span>
            <span className="muted">{s.clipDelayMs} ms</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              aria-label="Clip delay"
              className="min-w-0 flex-1"
              type="range"
              min={MIN_CLIP_DELAY_MS}
              max={MAX_CLIP_DELAY_MS}
              step={CLIP_DELAY_STEP_MS}
              value={s.clipDelayMs}
              onChange={(e) => void setSettings({ clipDelayMs: Number(e.target.value) })}
            />
            <input
              className="w-24 rounded-md border border-slate-500/30 bg-transparent px-2 py-1 text-right"
              type="number"
              min={MIN_CLIP_DELAY_MS}
              max={MAX_CLIP_DELAY_MS}
              step={CLIP_DELAY_STEP_MS}
              value={s.clipDelayMs}
              onChange={(e) => void setSettings({ clipDelayMs: Number(e.target.value) })}
            />
          </div>
          <div className="muted mt-1 flex justify-between text-xs">
            <span>{MIN_CLIP_DELAY_MS} ms</span>
            <span>{MAX_CLIP_DELAY_MS} ms</span>
          </div>
        </div>
        <Toggle
          label="Adaptive backoff"
          description="Automatically slow down when the store pushes back, then speed back up. The slider above is the starting point and the fastest it will go."
          checked={s.adaptiveBackoff}
          onChange={(adaptiveBackoff) => void setSettings({ adaptiveBackoff })}
        />
        <button
          disabled={s.clipDelayMs === DEFAULT_CLIP_DELAY_MS}
          onClick={() => void setSettings({ clipDelayMs: DEFAULT_CLIP_DELAY_MS })}
        >
          Reset to default ({DEFAULT_CLIP_DELAY_MS} ms)
        </button>
      </Section>

      <Section title="Display">
        <Toggle
          label="Show coupon count"
          checked={s.showCount}
          onChange={(showCount) => void setSettings({ showCount })}
        />
        <Toggle
          label="Show estimated savings"
          description="Counts dollar-off coupons only. Percent-off and buy-one-get-one offers can't be valued."
          checked={s.showSavings}
          onChange={(showSavings) => void setSettings({ showSavings })}
        />
      </Section>

      <Section title="Sync">
        <Toggle
          label="Keep totals in sync across devices"
          description="Uses your Chrome profile's sync storage. Totals merge by taking the larger value per store."
          checked={s.syncStats}
          onChange={(syncStats) => void setSettings({ syncStats })}
        />
      </Section>

      <Section title="Data">
        <div className="flex flex-wrap gap-2">
          <button
            className="danger"
            onClick={() => {
              if (confirm("Reset all clipped coupon totals? This cannot be undone.")) {
                void resetStats();
              }
            }}
          >
            Reset totals
          </button>
          <button onClick={() => void copyDebugInfo()}>
            {copied ? "Copied!" : "Copy debug info"}
          </button>
        </div>
      </Section>

      <p className="muted mt-6 text-center text-xs">v{version}</p>
      <Footer showGithub />
    </div>
  );
}
