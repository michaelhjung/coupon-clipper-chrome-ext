import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { albertsonsSession, flush, jsonResponse, render } from "./helpers";
import {
  createAlbertsonsAdapter,
  parseAlbertsonsCoupons,
  parseAlbertsonsOffers,
} from "../src/adapters/albertsons";
import { setSessionForTests } from "../src/content/pageBridge";
import { getStoreByName } from "../src/shared/constants";

const fixture = readFileSync(join(__dirname, "fixtures/albertsons-cards.html"), "utf8");
const safeway = getStoreByName("Safeway")!;

describe("parseAlbertsonsCoupons", () => {
  beforeEach(() => {
    render(fixture);
  });

  it("returns one entry per unclipped coupon with value and program", () => {
    const coupons = parseAlbertsonsCoupons(document);
    expect(coupons.map((c) => c.id)).toEqual(["12345", "22222", "33333"]);
    expect(coupons[0]).toEqual({
      id: "12345",
      name: "Tillamook Cheese",
      valueCents: 100,
      pgm: "MF",
    });
    expect(coupons[1].valueCents).toBeNull();
    expect(coupons[1].pgm).toBe("SC");
    expect(coupons[2].pgm).toBeUndefined();
    expect(coupons[2].valueCents).toBe(250);
  });
});

describe("createAlbertsonsAdapter.clip", () => {
  beforeEach(() => {
    render(fixture);
    setSessionForTests(albertsonsSession("908"));
  });

  it("returns ok on status 1", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { items: [{ status: 1 }] }));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    const [coupon] = parseAlbertsonsCoupons(document);
    expect(await adapter.clip(coupon)).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/abs/pub/web/j4u/api/offers/clip?storeId=908");
    expect(JSON.parse(String(init.body)).items[0]).toEqual({
      clipType: "C",
      itemId: "12345",
      itemType: "MF",
    });
  });

  it("returns rate_limited on HTTP 429", async () => {
    const fetch = vi.fn(async () => jsonResponse(429, {}));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    expect(await adapter.clip(parseAlbertsonsCoupons(document)[0])).toBe("rate_limited");
  });

  it("tries program candidates for an unknown program and counts once", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ status: 0 }] }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ status: 1 }] }));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    const unknown = parseAlbertsonsCoupons(document)[2];
    expect(await adapter.clip(unknown)).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns failed when every candidate fails", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { items: [{ status: 0 }] }));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    expect(await adapter.clip(parseAlbertsonsCoupons(document)[2])).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("marks the card clipped", () => {
    const adapter = createAlbertsonsAdapter(safeway, { fetch: vi.fn() });
    adapter.markClipped(parseAlbertsonsCoupons(document)[0]);
    expect(document.querySelector("#couponAddBtn12345")).toBeNull();
    expect(document.querySelectorAll(".clipped").length).toBe(2);
  });
});

// Trimmed from a real companiongalleryoffer response.
const offer = (overrides: Record<string, unknown>) => ({
  offerId: "1",
  name: "Some Brand",
  offerPgm: "MF",
  offerPrice: "$1.00 OFF",
  status: "U",
  deleted: false,
  ...overrides,
});

describe("parseAlbertsonsOffers", () => {
  it("returns only unclipped, non-deleted offers as coupons", () => {
    const json = {
      companionGalleryOffer: {
        "40061918": offer({ offerId: "40061918", name: "O Organics Purchase", offerPgm: "PD" }),
        "40167906": offer({ offerId: "40167906", status: "C" }),
        "40481026": offer({ offerId: "40481026", deleted: true }),
        "40497939": offer({ offerId: "40497939", name: "BATISTE", offerPgm: "MF", offerPrice: "$2.00 OFF" }),
      },
    };
    expect(parseAlbertsonsOffers(json)).toEqual([
      { id: "40061918", name: "O Organics Purchase", valueCents: 100, pgm: "PD" },
      { id: "40497939", name: "BATISTE", valueCents: 200, pgm: "MF" },
    ]);
  });

  it("returns null for an unrecognised shape", () => {
    expect(parseAlbertsonsOffers(null)).toBeNull();
    expect(parseAlbertsonsOffers({ error: "nope" })).toBeNull();
    expect(parseAlbertsonsOffers({ companionGalleryOffer: "?" })).toBeNull();
  });

  it("treats an empty gallery as zero coupons, not a failure", () => {
    expect(parseAlbertsonsOffers({ companionGalleryOffer: {} })).toEqual([]);
  });
});

describe("createAlbertsonsAdapter.fetchUnclipped", () => {
  beforeEach(() => {
    setSessionForTests(albertsonsSession("951"));
  });

  it("GETs the gallery for the session store with the API headers", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(200, { companionGalleryOffer: { "1": offer({ offerId: "1" }) } })
    );
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    const coupons = await adapter.fetchUnclipped!();
    expect(coupons).toEqual([{ id: "1", name: "Some Brand", valueCents: 100, pgm: "MF" }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(
      /\/abs\/pub\/xapi\/offers\/companiongalleryoffer\?storeId=951&rand=\d+&includeRedmBonusPathFPOffers=true$/
    );
    expect(init.method ?? "GET").toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({
      SWY_SSO_TOKEN: "tok",
      "X-swyConsumerDirectoryPro": "tok",
      "X-IBM-Client-Id": "cid",
      "X-IBM-Client-Secret": "sec",
      "X-SWY_API_KEY": "emjou",
    });
  });

  it("returns null on a non-200 response", async () => {
    const fetch = vi.fn(async () => jsonResponse(400, { error: "bad" }));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    expect(await adapter.fetchUnclipped!()).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    expect(await adapter.fetchUnclipped!()).toBeNull();
  });

  it("returns null when the body is not a gallery", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { something: "else" }));
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    expect(await adapter.fetchUnclipped!()).toBeNull();
  });
});

describe("createAlbertsonsAdapter.fetchUnclipped ordering", () => {
  beforeEach(() => {
    render(fixture); // renders 12345, 22222, 33333 in that order
    setSessionForTests(albertsonsSession("951"));
  });

  it("clips in the order cards appear on the page, unrendered offers last", async () => {
    // Numeric key order would be 5, 12345, 22222 — the page shows 12345 then 22222.
    const fetch = vi.fn(async () =>
      ({
        status: 200,
        json: async () => ({
          companionGalleryOffer: {
            "22222": offer({ offerId: "22222" }),
            "12345": offer({ offerId: "12345" }),
            "5": offer({ offerId: "5" }),
          },
        }),
      }) as Response
    );
    const adapter = createAlbertsonsAdapter(safeway, { fetch });
    const coupons = await adapter.fetchUnclipped!();
    expect(coupons!.map((c) => c.id)).toEqual(["12345", "22222", "5"]);
  });
});

describe("createAlbertsonsAdapter.markClipped for cards rendered later", () => {
  const card = (id: string) => `
    <div class="coupon-card__card-body">
      <h5 class="cpn-title">Later ${id}</h5>
      <loyalty-card-action-buttons>
        <button id="couponAddBtn${id}">Clip Coupon</button>
      </loyalty-card-action-buttons>
    </div>`;

  beforeEach(() => {
    render("<div id='gallery'></div>");
  });

  it("patches a clipped coupon's card when the site renders it after the clip", async () => {
    const adapter = createAlbertsonsAdapter(safeway, { fetch: vi.fn() });
    adapter.markClipped({ id: "777", name: "Later 777", valueCents: null });
    expect(document.querySelector("#couponAddBtn777")).toBeNull();

    document.getElementById("gallery")!.insertAdjacentHTML("beforeend", card("777") + card("888"));
    await flush();

    expect(document.querySelector("#couponAddBtn777")).toBeNull();
    expect(document.querySelectorAll(".clipped").length).toBe(1);
    expect(document.querySelector("#couponAddBtn888")).not.toBeNull(); // untouched
  });
});
