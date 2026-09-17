import { describeRun, formatRelativeTime } from "../../shared/format";

import type { LastRun as LastRunType } from "../../shared/types";

export const LastRun = ({ lastRuns }: { lastRuns: Record<string, LastRunType> }) => {
  const runs = Object.values(lastRuns).sort((a, b) => b.at - a.at);
  if (!runs.length) return null;
  const [latest, ...rest] = runs;
  return (
    <details className="card mt-2 w-full">
      <summary className="cursor-pointer list-none text-sm">
        <span className="font-semibold">Last run</span> · {latest.store} ·{" "}
        {formatRelativeTime(latest.at)}
        <br />
        <span className="muted">{describeRun(latest)}</span>
      </summary>
      {rest.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-500/20 text-sm">
          {rest.map((r) => (
            <li key={r.store} className="flex justify-between py-1">
              <span>
                {r.store} <span className="muted">· {formatRelativeTime(r.at)}</span>
              </span>
              <span className="muted">{describeRun(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
};
