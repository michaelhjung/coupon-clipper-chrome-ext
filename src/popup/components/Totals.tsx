import { formatCount, formatDollars } from "../../shared/format";

import type { Settings, Stats } from "../../shared/types";

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

export const Totals = ({ stats, settings }: { stats: Stats; settings: Settings }) => {
  if (!settings.showCount && !settings.showSavings) return null;
  const clips = sum(stats.clipsByStore);
  const savings = sum(stats.savingsByStore);
  const cols = settings.showCount && settings.showSavings ? "grid-cols-2" : "grid-cols-1";
  return (
    <section className={`card mt-2 grid w-full gap-2 ${cols}`}>
      {settings.showCount && (
        <div>
          <p className="muted text-xs font-semibold uppercase">Total clipped</p>
          <p
            className="mt-1 text-2xl font-semibold leading-none"
            title={clips.toLocaleString("en-US")}
          >
            <span className="text-emerald-500">{formatCount(clips)}</span>
            <span className="muted ml-1 text-sm font-medium">
              coupon{clips === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      )}
      {settings.showSavings && (
        <div>
          <p className="muted text-xs font-semibold uppercase">Est. savings</p>
          <p
            className="mt-1 text-2xl font-semibold leading-none"
            title={`$${(savings / 100).toFixed(2)}`}
          >
            {formatDollars(savings)}
          </p>
        </div>
      )}
    </section>
  );
};
