import { describe, expect, it } from "vitest";

import { describeRun, summaryMessage } from "../src/shared/format";

import type { RunSummary } from "../src/shared/types";

const run = (o: Partial<RunSummary>): RunSummary => ({
  store: "Raley's",
  trigger: "manual",
  clipped: 157,
  expired: 0,
  failed: 0,
  total: 169,
  status: "done",
  ...o,
});

describe("run wording", () => {
  it("describes the popup's last run", () => {
    expect(describeRun(run({}))).toBe("157 clipped");
    expect(describeRun(run({ expired: 12 }))).toBe("157 clipped · 12 expired");
    expect(describeRun(run({ expired: 12, failed: 1, status: "stopped" }))).toBe(
      "157 clipped · 12 expired · 1 failed · stopped"
    );
    expect(describeRun(run({ total: 0, clipped: 0 }))).toBe("nothing to clip");
    expect(describeRun(run({ status: "error", message: "boom" }))).toBe("error: boom");
  });

  it("writes the notification for an auto run", () => {
    expect(summaryMessage(run({}))).toBe("Raley's: clipped 157");
    expect(summaryMessage(run({ expired: 12, failed: 1 }))).toBe(
      "Raley's: clipped 157, 12 expired, 1 failed"
    );
    expect(summaryMessage(run({ total: 0, clipped: 0 }))).toBe("Raley's: everything's already clipped");
  });
});
