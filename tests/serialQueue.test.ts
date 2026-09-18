import { describe, expect, it } from "vitest";

import { createSerialQueue } from "../src/shared/serialQueue";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createSerialQueue", () => {
  it("runs jobs one after another in submission order", async () => {
    const serialized = createSerialQueue();
    const order: string[] = [];
    const first = serialized(async () => {
      order.push("first:start");
      await tick();
      order.push("first:end");
      return 1;
    });
    const second = serialized(async () => {
      order.push("second:start");
      return 2;
    });
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("keeps running after a job fails and rejects only that job's caller", async () => {
    const serialized = createSerialQueue();
    const failing = serialized(async () => {
      throw new Error("boom");
    });
    const next = serialized(async () => "ran");
    await expect(failing).rejects.toThrow("boom");
    expect(await next).toBe("ran");
  });
});
