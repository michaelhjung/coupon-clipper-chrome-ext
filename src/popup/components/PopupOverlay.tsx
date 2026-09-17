import { sendToWorker } from "../../shared/messages";

import type { ActiveRun, RunKind } from "../../shared/types";

export interface PendingTask {
  kind: RunKind;
  at: number; // when the button was clicked
}

interface Props {
  run: ActiveRun | undefined;
  pending: PendingTask | null;
  tabId: number;
}

const LABELS: Record<RunKind, string> = {
  clip: "Starting…",
  count: "Counting coupons…",
  load: "Loading all coupons…",
};

const Dots = () => (
  <span className="inline-flex gap-1" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
        style={{ animationDelay: `${i * 100}ms` }}
      />
    ))}
  </span>
);

// Covers the popup while any task runs. Shows instantly from local pending
// state, then follows the worker's active run until it clears.
export const PopupOverlay = ({ run, pending, tabId }: Props) => {
  if (!run && !pending) return null;
  const kind = run?.kind ?? pending!.kind;
  const clipping = run?.kind === "clip" && run.phase === "clipping";
  const done = run ? run.clipped + run.expired + run.failed : 0;
  const pct = run?.total ? Math.round((done / run.total) * 100) : 0;
  const label = clipping
    ? `Clipping ${run.clipped} / ${run.total}`
    : run?.kind === "clip"
      ? "Loading all coupons…"
      : LABELS[kind];

  return (
    <div
      role="status"
      aria-live="polite"
      className="popup-overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Dots />
      <p className="text-base font-medium">
        {label}
        {run && run.expired > 0 && (
          <span className="muted ml-1 text-sm">· {run.expired} expired</span>
        )}
        {run && run.failed > 0 && (
          <span className="ml-1 text-sm text-amber-500">· {run.failed} failed</span>
        )}
      </p>
      {clipping && (
        <>
          <div className="h-2 w-56 rounded bg-slate-500/25">
            <div
              className="h-2 rounded bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="muted text-xs">
            {pct}% · Delay {run.delayMs} ms
          </p>
          <button className="danger text-xs" onClick={() => sendToWorker({ type: "STOP", tabId })}>
            Stop
          </button>
        </>
      )}
    </div>
  );
};
