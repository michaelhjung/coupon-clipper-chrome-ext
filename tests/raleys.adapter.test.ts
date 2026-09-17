import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdapter } from "../src/adapters/index";
import { createRaleysAdapter } from "../src/adapters/raleys";
import { getStoreByName } from "../src/shared/constants";

import type { RaleysDeps } from "../src/adapters/raleys";

const fixture = readFileSync(join(__dirname, "fixtures/raleys-cards.html"), "utf8");
const raleys = getStoreByName("Raley's")!;

describe("Raley's adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = fixture;
  });

  it("finds unclipped coupons with the card id, name and value", () => {
    const coupons = createRaleysAdapter(raleys).getUnclipped();
    expect(coupons).toHaveLength(2);
    expect(coupons[0]).toEqual({
      id: "3537319",
      name: "$5.99 ea. Seedless Watermelon. In our Produce Dept.",
      valueCents: 599,
    });
    expect(coupons[1]).toEqual({
      id: "3537320",
      name: "Buy 2 get 1 free Organic Bananas",
      valueCents: null,
    });
  });

  it("falls back to the position when a card has no id or label", () => {
    document.body.innerHTML = "<main><article><button><p>Clip</p></button></article></main>";
    const [coupon] = createRaleysAdapter(raleys).getUnclipped();
    expect(coupon).toEqual({ id: "raleys-0", name: "Unnamed coupon", valueCents: null });
  });

  it("clips by clicking and confirming the button changed", async () => {
    const adapter = createRaleysAdapter(raleys);
    const [coupon] = adapter.getUnclipped();
    const button = document.getElementById("3537319")!.querySelector("button")!;
    button.addEventListener("click", () => {
      button.querySelector("p")!.textContent = "Clipped";
    });
    expect(await adapter.clip(coupon)).toBe("ok");
  });

  it("reports failed when nothing changes", async () => {
    const adapter = createRaleysAdapter(raleys);
    const [coupon] = adapter.getUnclipped();
    expect(await adapter.clip(coupon)).toBe("failed");
  }, 5000);

  describe("with the network bridge", () => {
    const bridge = (statuses: Array<number | null>): RaleysDeps => {
      const queue = [...statuses];
      return {
        fetch: vi.fn(async () => {
          throw new Error("no api in this test");
        }),
        bridge: {
          isReady: () => true,
          nextClipResponse: vi.fn(async () => {
            const status = queue.shift() ?? null;
            return status === null ? null : { status, body: "" };
          }),
        },
      };
    };

    it("confirms with the clip request's status instead of the button state", async () => {
      const adapter = createRaleysAdapter(raleys, bridge([200, 400, 429, null]));
      const [a, b] = adapter.getUnclipped();
      expect(await adapter.clip(a)).toBe("ok");
      // The button changing does not make a rejected clip a success.
      const button = document.getElementById("3537319")!.querySelector("button")!;
      button.querySelector("p")!.textContent = "Clipped";
      expect(await adapter.clip(b)).toBe("failed");
      expect(await adapter.clip(b)).toBe("rate_limited");
      expect(await adapter.clip(b)).toBe("failed");
    });

    it("starts listening before clicking so the response is not missed", async () => {
      const deps = bridge([200]);
      const adapter = createRaleysAdapter(raleys, deps);
      const [coupon] = adapter.getUnclipped();
      const button = document.getElementById("3537319")!.querySelector("button")!;
      let listeningAtClick = false;
      button.addEventListener("click", () => {
        listeningAtClick = (deps.bridge.nextClipResponse as ReturnType<typeof vi.fn>).mock.calls.length === 1;
      });
      expect(await adapter.clip(coupon)).toBe("ok");
      expect(listeningAtClick).toBe(true);
    });

    it("fails a coupon whose card is no longer on the page", async () => {
      const adapter = createRaleysAdapter(raleys, bridge([200]));
      const [coupon] = adapter.getUnclipped();
      document.getElementById(coupon.id)!.remove();
      expect(await adapter.clip(coupon)).toBe("failed");
    });

    it("clicks the button the card currently has, not the one seen at scan time", async () => {
      const adapter = createRaleysAdapter(raleys, bridge([200]));
      const [coupon] = adapter.getUnclipped();
      // The site re-rendered the card (React swaps nodes) after our scan.
      const card = document.getElementById(coupon.id)!;
      const stale = card.querySelector("button")!;
      const fresh = stale.cloneNode(true) as HTMLButtonElement;
      stale.replaceWith(fresh);
      const clicked = vi.fn();
      fresh.addEventListener("click", clicked);
      expect(await adapter.clip(coupon)).toBe("ok");
      expect(clicked).toHaveBeenCalledTimes(1);
    });
  });

  it("createAdapter picks the strategy from the store", () => {
    expect(createAdapter(raleys).store.name).toBe("Raley's");
    expect(createAdapter(getStoreByName("Vons")!).store.name).toBe("Vons");
  });
});
