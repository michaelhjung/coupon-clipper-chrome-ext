import type { Coupon, RunSummary } from "./types";

const COMPACT_THRESHOLD = 100_000;

const plain = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCount = (n: number): string =>
  n < COMPACT_THRESHOLD ? plain.format(n) : compact.format(n).replace("K", "k");

export const formatDollars = (cents: number): string => {
  const dollars = cents / 100;
  if (dollars < 100) return `$${dollars.toFixed(2)}`;
  return `$${plain.format(Math.round(dollars))}`;
};

export const formatRelativeTime = (at: number, now = Date.now()): string => {
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

// " · 12 expired · 1 failed" — the parts of a run that were not clips.
export const tallyParts = (r: Pick<RunSummary, "expired" | "failed">) =>
  [r.expired ? `${r.expired} expired` : "", r.failed ? `${r.failed} failed` : ""].filter(Boolean);

// Popup "last run" line.
export const describeRun = (r: RunSummary): string => {
  if (r.status === "error") return `error: ${r.message ?? "unknown"}`;
  if (r.total === 0) return "nothing to clip";
  const parts = [`${r.clipped} clipped`, ...tallyParts(r)];
  if (r.status === "stopped") parts.push("stopped");
  return parts.join(" · ");
};

// Desktop notification after an auto run.
export const summaryMessage = (s: RunSummary): string => {
  if (s.status === "error") {
    return `${s.store}: something went wrong (${s.message ?? "unknown error"})`;
  }
  if (s.total === 0) return `${s.store}: everything's already clipped`;
  return [`${s.store}: clipped ${s.clipped}`, ...tallyParts(s)].join(", ");
};

// Tab title while a run is finishing.
export const finishedTitle = ({ status, clipped, expired, failed, total }: RunSummary): string => {
  if (status === "stopped") return `⏹ Stopped · ${clipped}/${total} clipped`;
  return ["✅ Done", `${clipped} clipped`, ...tallyParts({ expired, failed })].join(" · ");
};

// Log line detail: how many coupons of each program, e.g. {"MF":12,"SC":3}.
export const pgmBreakdown = (coupons: Pick<Coupon, "pgm">[]): string => {
  const byPgm: Record<string, number> = {};
  for (const c of coupons) byPgm[c.pgm ?? "?"] = (byPgm[c.pgm ?? "?"] ?? 0) + 1;
  return JSON.stringify(byPgm);
};
