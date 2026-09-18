import { AUTO_CLIP_COOLDOWN_MS } from "../shared/constants";
import { createSerialQueue } from "../shared/serialQueue";
import { getCooldowns, getSettings, setCooldown } from "../shared/storage";

import type { ActiveRun } from "../shared/types";

type LoadActiveRuns = () => Promise<Record<string, ActiveRun>>;

// Decisions run one at a time so two tabs asking together cannot both win.
const decide = createSerialQueue();

// Only one tab may auto-clip a store at a time, and the worker is the only
// place that sees every tab. A granted claim starts the store's cooldown
// right away, so a second tab asking before the first reports STARTED is
// refused as well; a tab that then finds itself signed out releases it.
export const claimAutoClip = (store: string, loadActiveRuns: LoadActiveRuns) =>
  decide(async (): Promise<{ ok: boolean }> => {
    const [settings, cooldowns, activeRuns] = await Promise.all([
      getSettings(),
      getCooldowns(),
      loadActiveRuns(),
    ]);
    if (!settings.autoClip) return { ok: false };
    if (Date.now() - (cooldowns[store] ?? 0) < AUTO_CLIP_COOLDOWN_MS) return { ok: false };
    if (Object.values(activeRuns).some((run) => run.store === store)) return { ok: false };
    await setCooldown(store, Date.now());
    return { ok: true };
  });

export const releaseAutoClip = (store: string) => setCooldown(store, 0);
