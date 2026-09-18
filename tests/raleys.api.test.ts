import { beforeEach, describe, expect, it, vi } from "vitest";

import { flush, jsonResponse, render } from "./helpers";
import { createRaleysAdapter, parseRaleysOffersPage, remainingOffsets } from "../src/adapters/raleys";
import { getStoreByName } from "../src/shared/constants";

import type { RaleysDeps } from "../src/adapters/raleys";

const raleys = getStoreByName("Raley's")!;

// Trimmed from a real GET /api/offers/get-offers response.
const offer = (o: Partial<Record<string, unknown>>) => ({
  PromotionDefinitionId: 580687,
  ExtPromotionId: "3534924",
  ExtBadgeTypeCode: "SomethingExtra",
  RewardType: "DollarOff",
  Headline: "Save $10",
  SubHeadline: "on your next $25 or more purchase.",
  IsAccepted: false,
  DiscountAmountType: "Dollar",
  DiscountAmount: 10,
  ...o,
});

const page = (data: unknown[], total: number, offset = 0) => ({ data, offset, limit: 30, total });

const deps = (fetch: RaleysDeps["fetch"], bridgeReady = false): RaleysDeps => ({
  fetch,
  bridge: { isReady: () => bridgeReady, nextClipResponse: vi.fn(async () => null) },
});

describe("remainingOffsets", () => {
  it("steps through the gallery from the end of the first page", () => {
    expect(remainingOffsets(30, 65)).toEqual([30, 60]);
    expect(remainingOffsets(30, 30)).toEqual([]);
    expect(remainingOffsets(5, 5)).toEqual([]);
  });

  it("does not re-request the first page when it came back empty", () => {
    expect(remainingOffsets(0, 90)).toEqual([]);
  });

  it("caps the number of pages", () => {
    expect(remainingOffsets(30, 1_000_000)).toHaveLength(100);
  });
});

describe("parseRaleysOffersPage", () => {
  it("keeps unclipped offers with id, name, value and program", () => {
    const parsed = parseRaleysOffersPage(
      page(
        [
          offer({}),
          offer({
            ExtPromotionId: "3534958",
            ExtBadgeTypeCode: "WeeklyExclusive",
            RewardType: "PricePoint",
            Headline: "$5.99 ea.",
            SubHeadline: "Gold Kiwi Fruit. 16 oz.",
            DiscountAmount: 5.99,
          }),
          offer({
            ExtPromotionId: "8298770",
            ExtBadgeTypeCode: "mfg",
            Headline: "Save $0.25 on any ONE (1) Select Pack of Huggies",
            SubHeadline: "Save $0.25 on any ONE (1) Pack of Huggies, Natural Care",
            DiscountAmount: 0.25,
          }),
          offer({
            ExtPromotionId: "8713422",
            ExtBadgeTypeCode: "mfg",
            Headline: "Save $3.00 on ONE Tide Laundry Detergent 92-105 oz OR Tide Powder (exclud",
            SubHeadline: "ONE Tide Laundry Detergent 92-105 oz OR Tide Powder (excludes Tide EVO)\nDealer: Submission to P&G",
            DiscountAmount: 3,
          }),
          offer({ ExtPromotionId: "1", IsAccepted: true }),
        ],
        178
      )
    );
    expect(parsed).toEqual({
      total: 178,
      count: 5,
      unclipped: [
        {
          id: "3534924",
          name: "Save $10 on your next $25 or more purchase.",
          valueCents: 1000,
          pgm: "SomethingExtra",
        },
        {
          id: "3534958",
          name: "$5.99 ea. Gold Kiwi Fruit. 16 oz.",
          valueCents: null, // a price point, not a saving
          pgm: "WeeklyExclusive",
        },
        {
          id: "8298770",
          // the sub-headline restates the headline; keep the fuller one
          name: "Save $0.25 on any ONE (1) Pack of Huggies, Natural Care",
          valueCents: 25,
          pgm: "mfg",
        },
        {
          id: "8713422",
          // the headline already restates the (truncated) sub-headline; legal
          // text after the line break is dropped
          name: "Save $3.00 on ONE Tide Laundry Detergent 92-105 oz OR Tide Powder (exclud",
          valueCents: 300,
          pgm: "mfg",
        },
      ],
    });
  });

  it("returns null for anything that is not an offers page", () => {
    expect(parseRaleysOffersPage({ message: "Not Authorized" })).toBeNull();
    expect(parseRaleysOffersPage(null)).toBeNull();
    expect(parseRaleysOffersPage({ data: "nope", total: 1 })).toBeNull();
  });
});

describe("createRaleysAdapter with the offers API", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("pages through get-offers until the total is reached", async () => {
    const fetch = vi.fn<RaleysDeps["fetch"]>(async (url) => {
      const u = String(url);
      const offset = Number(new URL(u, "https://www.raleys.com").searchParams.get("offset"));
      const ids = Array.from({ length: Math.min(30, 65 - offset) }, (_, i) => String(offset + i));
      return jsonResponse(200, page(ids.map((id) => offer({ ExtPromotionId: id, IsAccepted: id === "3" })), 65, offset));
    });
    const coupons = await createRaleysAdapter(raleys, deps(fetch)).fetchUnclipped!();
    expect(coupons).toHaveLength(64);
    expect(coupons!.map((c) => c.id)).not.toContain("3");
    expect(coupons!.map((c) => Number(c.id))).toEqual([...coupons!.map((c) => Number(c.id))].sort((a, b) => a - b));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[0][0])).toContain("/api/offers/get-offers?type=&offset=0&rows=30");
    expect(String(fetch.mock.calls[2][0])).toContain("offset=60");
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("fetches the remaining pages concurrently once the total is known", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetch = vi.fn<RaleysDeps["fetch"]>(async (url) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      const offset = Number(new URL(String(url), "https://www.raleys.com").searchParams.get("offset"));
      const ids = Array.from({ length: 30 }, (_, i) => String(offset + i));
      return jsonResponse(200, page(ids.map((id) => offer({ ExtPromotionId: id })), 120, offset));
    });
    await createRaleysAdapter(raleys, deps(fetch)).fetchUnclipped!();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBe(3);
  });

  it("retries a request that times out or fails, and gives up after the last attempt", async () => {
    const attempts: string[] = [];
    const fetch = vi.fn<RaleysDeps["fetch"]>(async (url, init) => {
      attempts.push(String(url));
      if (attempts.length === 1) throw new DOMException("aborted", "AbortError");
      if (attempts.length === 2) throw new TypeError("Failed to fetch");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jsonResponse(200, true);
    });
    const adapter = createRaleysAdapter(raleys, deps(fetch));
    expect(await adapter.clip({ id: "1", name: "x", valueCents: null, pgm: "mfg" })).toBe("ok");
    expect(attempts).toHaveLength(3);

    const alwaysDown = createRaleysAdapter(raleys, deps(async () => {
      throw new DOMException("aborted", "AbortError");
    }));
    expect(await alwaysDown.clip({ id: "1", name: "x", valueCents: null, pgm: "mfg" })).toBe("failed");
  });

  it("lists every offer once even when the gallery shifts between page requests", async () => {
    // Offer "30" appears at the end of page 1 and again at the start of page 2.
    const fetch = vi.fn<RaleysDeps["fetch"]>(async (url) => {
      const offset = Number(new URL(String(url), "https://www.raleys.com").searchParams.get("offset"));
      const ids = offset === 0 ? Array.from({ length: 30 }, (_, i) => String(i + 1)) : ["30", "31"];
      return jsonResponse(200, page(ids.map((id) => offer({ ExtPromotionId: id })), 32, offset));
    });
    const coupons = await createRaleysAdapter(raleys, deps(fetch)).fetchUnclipped!();
    expect(coupons!.map((c) => c.id).filter((id) => id === "30")).toHaveLength(1);
    expect(coupons).toHaveLength(31);
  });

  it("resolves null when the API is unavailable so the page scan can take over", async () => {
    const unauthorized = deps(async () => jsonResponse(401, { message: "Not Authorized" }));
    expect(await createRaleysAdapter(raleys, unauthorized).fetchUnclipped!()).toBeNull();
    const broken = deps(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await createRaleysAdapter(raleys, broken).fetchUnclipped!()).toBeNull();
  });

  it("clips through the endpoint that matches the offer's program", async () => {
    const fetch = vi.fn<RaleysDeps["fetch"]>(async () => jsonResponse(200, true));
    const adapter = createRaleysAdapter(raleys, deps(fetch));
    expect(await adapter.clip({ id: "8298770", name: "x", valueCents: 25, pgm: "mfg" })).toBe("ok");
    expect(await adapter.clip({ id: "3534926", name: "y", valueCents: null, pgm: "WeeklyExclusive" })).toBe("ok");
    expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/api/offers/accept-coupons",
      "/api/offers/accept",
    ]);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ offerId: "8298770", offerType: "mfg" }),
    });
  });

  it("maps expiry, other rejections and rate limits", async () => {
    const results = [
      jsonResponse(400, { message: "Promo expired or no longer valid." }),
      jsonResponse(400, { message: "No data found for supplied input parameters." }),
      jsonResponse(429, ""),
      jsonResponse(200, false),
    ];
    const adapter = createRaleysAdapter(raleys, deps(async () => results.shift()!));
    const c = { id: "1", name: "x", valueCents: null, pgm: "mfg" };
    expect(await adapter.clip(c)).toBe("expired");
    expect(await adapter.clip(c)).toBe("failed");
    expect(await adapter.clip(c)).toBe("rate_limited");
    expect(await adapter.clip(c)).toBe("failed");
  });

  it("restyles the card's button the way the site renders a clipped one", () => {
    // Real markup of an unclipped button, trimmed.
    document.body.innerHTML = `<div id="8298770">
      <button type="button" class="group flex p-2 text-white bg-primary-700 border border-transparent hover:bg-primary-800 focus-visible:outline-primary-700 disabled:hover:bg-primary-700 rounded-full" aria-label="Clip Save $0.25">
        <span class="items-center rounded-md max-w-md"><p class="p5 desktop:p5 inline-block pr-2 font-semibold ">Clip</p><svg viewBox="0 0 21 21" alt="scissor" class="inline h-4 w-4 fill-white stroke-none"><path d="M6 2"></path></svg></span>
      </button></div>`;
    const adapter = createRaleysAdapter(raleys, deps(async () => jsonResponse(200, true)));
    adapter.markClipped({ id: "8298770", name: "x", valueCents: 25, pgm: "mfg" });
    const button = document.querySelector("button")!;
    expect(button.disabled).toBe(false);
    expect(button.className).toBe(
      "group flex p-2 text-white bg-primary-700 hover:bg-primary-800 disabled:hover:bg-primary-700 rounded-full " +
        "border-2 focus-visible:outline-wellness-300 border-wellness-300 !bg-white focus-visible:border-wellness-300 focus-visible:outline-none"
    );
    const label = button.querySelector("p")!;
    expect(label.textContent).toBe("Clipped");
    expect(label.className).toBe("p5 desktop:p5 inline-block pr-2 font-semibold text-wellness-300");
    const svg = button.querySelector("svg")!;
    expect(svg.getAttribute("alt")).toBe("check-circle");
    expect(svg.getAttribute("class")).toBe("inline h-[1.125rem] w-[1.125rem] fill-wellness-300 stroke-none");
    expect(svg.querySelector("circle")).not.toBeNull();
    expect(adapter.getUnclipped()).toHaveLength(0);
  });

  it("re-marks a clipped card the site renders again later", async () => {
    const card = '<div id="8298770"><button aria-label="Clip Save $0.25"><span><p>Clip</p></span></button></div>';
    render(card);
    const adapter = createRaleysAdapter(raleys, deps(async () => jsonResponse(200, true)));
    adapter.markClipped({ id: "8298770", name: "x", valueCents: 25, pgm: "mfg" });
    // The site re-mounts the list (e.g. after "Load more") with fresh nodes.
    document.body.innerHTML = card + card.replace(/8298770/g, "111");
    await flush();
    expect(document.getElementById("8298770")!.querySelector("button p")!.textContent).toBe("Clipped");
    expect(document.getElementById("111")!.querySelector("button p")!.textContent).toBe("Clip");
  });

  it("reports signed in from the auth session", async () => {
    const signedIn = deps(async () => jsonResponse(200, { user: { email: "a@b.c" } }));
    expect(await createRaleysAdapter(raleys, signedIn).isSignedIn()).toBe(true);
    const signedOut = deps(async () => jsonResponse(200, {}));
    expect(await createRaleysAdapter(raleys, signedOut).isSignedIn()).toBe(false);
  });
});
