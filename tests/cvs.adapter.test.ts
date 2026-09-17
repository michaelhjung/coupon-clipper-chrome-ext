import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { flush, jsonResponse, render } from "./helpers";
import { createCvsAdapter, parseCvsCards, parseCvsFeed } from "../src/adapters/cvs";
import { createAdapter } from "../src/adapters/index";
import { getStoreByName } from "../src/shared/constants";

import type { CvsDeps } from "../src/adapters/cvs";

const fixture = readFileSync(join(__dirname, "fixtures/cvs-cards.html"), "utf8");
const cvs = getStoreByName("CVS")!;

const deps = (fetch: CvsDeps["fetch"]): CvsDeps => ({ fetch });

// Trimmed response of the loyalty feed: two loadable manufacturer coupons,
// one already on the card (it appears in both lists), and the card cipher.
const feed = (overrides: Record<string, unknown> = {}) => ({
  statusCode: "0000",
  statusDescription: "Success",
  data: {
    getEcCustomerProfile: {
      couponCategories: {
        extrabucks: [],
        otherDeals: [
          {
            cmpgnId: 38737,
            cpnNbr: 1010611,
            cpnSeqNbr: 86298975119,
            loadActlDt: "2026-09-17",
            maxRedeemAmt: "3.00",
            mfrInd: "Y",
            mfrOfferValueDsc: "Save $3.00",
            mfrOfferBrandName: "Pull-ups®/Goodnites®",
          },
          {
            cmpgnId: 38737,
            cpnNbr: 1010630,
            maxRedeemAmt: "3.00",
            cpnDsc: "on any TWO (2) Packages of Huggies® Diapers",
            mfrInd: "Y",
            mfrOfferValueDsc: "Save $3.00",
            mfrOfferBrandName: "Huggies® Diapers",
          },
          {
            cmpgnId: 133943,
            cpnNbr: 555,
            maxRedeemAmt: "5.00",
            cpnDsc: "on any vitamins",
            mfrInd: "N",
            mfrOfferValueDsc: "Save 20%",
            mfrOfferBrandName: "Any Vitamins",
          },
        ],
        personalizedDeals: [],
      },
      xtraCard: { xtraCardCipherTxt: "5b50e68d83a00ba5" },
      xtraCare: {
        cpns: [{ cmpgnId: 38737, cpnNbr: 1010611, cpnSeqNbr: 86298975119 }],
        mfrCpnAvailPool: [],
      },
      ...overrides,
    },
  },
});

describe("parseCvsCards", () => {
  beforeEach(() => {
    render(fixture);
  });

  it("returns the cards with a Send to card button, keyed by campaign and coupon number", () => {
    const coupons = parseCvsCards(document);
    expect(coupons).toEqual([
      { id: "38737_1010630", name: "Save $3.00 Huggies® Diapers", valueCents: 300 },
      { id: "133943_555", name: "Save 20% Any Vitamins", valueCents: null },
    ]);
  });

  it("falls back to the position when a card has no details link", () => {
    render(
      '<div data-testid="coupon"><h3><span class="visually-hidden">Save $1.00 Soap</span></h3>' +
        "<send-to-card-action><button>Send to card</button></send-to-card-action></div>"
    );
    expect(parseCvsCards(document)).toEqual([{ id: "cvs-0", name: "Save $1.00 Soap", valueCents: 100 }]);
  });
});

describe("parseCvsFeed", () => {
  it("keeps coupons that are not on the card, with the card cipher", () => {
    const parsed = parseCvsFeed(feed());
    expect(parsed?.card).toBe("5b50e68d83a00ba5");
    expect(parsed?.unclipped).toEqual([
      { id: "38737_1010630", name: "Save $3.00 Huggies® Diapers", valueCents: 300, pgm: "mfr" },
      { id: "133943_555", name: "Save 20% Any Vitamins", valueCents: null, pgm: "cvs" },
    ]);
    expect(parsed?.onCard).toBe(1);
  });

  it("treats a coupon with a sequence number as on the card even if the cpns list is empty", () => {
    const parsed = parseCvsFeed(feed({ xtraCare: { cpns: [] } }));
    expect(parsed?.unclipped.map((c) => c.id)).toEqual(["38737_1010630", "133943_555"]);
  });

  it("falls back to the description when the offer has no headline", () => {
    const body = feed();
    const offer = body.data.getEcCustomerProfile.couponCategories.otherDeals[1] as Record<string, unknown>;
    delete offer.mfrOfferValueDsc;
    delete offer.mfrOfferBrandName;
    expect(parseCvsFeed(body)?.unclipped[0].name).toBe("on any TWO (2) Packages of Huggies® Diapers");
  });

  it("returns null for anything that is not a feed", () => {
    expect(parseCvsFeed(null)).toBeNull();
    expect(parseCvsFeed({ statusCode: "1001", statusDescription: "AUTHORIZATION_ERROR" })).toBeNull();
    expect(parseCvsFeed({ statusCode: "0000", data: {} })).toBeNull();
  });
});

describe("createCvsAdapter with the API", () => {
  beforeEach(() => {
    render(fixture);
  });

  it("is what createAdapter builds for the cvs-api strategy", () => {
    expect(createAdapter(cvs).store.name).toBe("CVS");
  });

  it("fetches unclipped coupons from the loyalty feed", async () => {
    const fetch = vi.fn<CvsDeps["fetch"]>(async () => jsonResponse(200, feed()));
    const coupons = await createCvsAdapter(cvs, deps(fetch)).fetchUnclipped!();
    expect(coupons?.map((c) => c.id)).toEqual(["38737_1010630", "133943_555"]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/retail/client/experience/v2/load/2b3038e6-7c9c-4a0d-8f72-798fe598cfe1");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect((init.headers as Record<string, string>)["x-api-key"]).toBeTruthy();
  });

  it("returns null when the feed is unavailable so the page scan runs", async () => {
    const unauthorized = deps(async () => jsonResponse(401, { statusCode: 1001 }));
    expect(await createCvsAdapter(cvs, unauthorized).fetchUnclipped!()).toBeNull();
    const down = deps(async () => {
      throw new Error("network");
    });
    expect(await createCvsAdapter(cvs, down).fetchUnclipped!()).toBeNull();
  });

  it("clips through the API with the card cipher from the feed", async () => {
    const fetch = vi.fn<CvsDeps["fetch"]>(async (url) =>
      String(url).includes("createSingleCoupon")
        ? jsonResponse(200, [{ cpnSeqNbr: 1, cpnStatusCd: 0, cmpgnId: 38737, cpnSkuNbr: 1010630 }])
        : jsonResponse(200, feed())
    );
    const adapter = createCvsAdapter(cvs, deps(fetch));
    const [coupon] = (await adapter.fetchUnclipped!())!;
    expect(await adapter.clip(coupon)).toBe("ok");
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/RETAGPV3/ExtraCare/V5/createSingleCoupon");
    expect(init.headers).toMatchObject({ user_id: "CVS.COM", msg_src_cd: "W" });
    expect((init.headers as Record<string, string>).src_loc_cd).toBeTruthy();
    expect(JSON.parse(String(init.body))).toMatchObject({
      cmpgnId: "38737",
      cpnSkuNbr: "1010630",
      extraCareCard: "5b50e68d83a00ba5",
      cardType: "0006",
      header: { appName: "CVS_WEB" },
    });
  });

  it("fetches the feed for the cipher when clipping before any fetch", async () => {
    const fetch = vi.fn<CvsDeps["fetch"]>(async (url) =>
      String(url).includes("createSingleCoupon")
        ? jsonResponse(200, [{ cpnStatusCd: 0 }])
        : jsonResponse(200, feed())
    );
    const adapter = createCvsAdapter(cvs, deps(fetch));
    expect(await adapter.clip({ id: "38737_1010630", name: "x", valueCents: null, pgm: "mfr" })).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetch.mock.calls[1][1]!.body)).extraCareCard).toBe("5b50e68d83a00ba5");
  });

  it("maps already-on-card, unknown coupons, errors and rate limits", async () => {
    const results = [
      jsonResponse(200, feed()),
      jsonResponse(200, [{ cpnSeqNbr: 0, cpnStatusCd: 14 }]),
      jsonResponse(200, [{ cpnSeqNbr: 0, cpnStatusCd: 10 }]),
      jsonResponse(200, [{ errorCd: 4, errorMsg: "Invalid XC Card" }]),
      jsonResponse(429, ""),
      jsonResponse(200, "", ""),
      jsonResponse(500, { createSingleCouponResponse: { header: { statusCode: "1003" } } }),
    ];
    const adapter = createCvsAdapter(cvs, deps(async () => results.shift()!));
    const c = { id: "38737_1", name: "x", valueCents: null, pgm: "mfr" };
    expect(await adapter.clip(c)).toBe("ok"); // already on card: the outcome the user wanted
    expect(await adapter.clip(c)).toBe("failed");
    expect(await adapter.clip(c)).toBe("failed");
    expect(await adapter.clip(c)).toBe("rate_limited");
    expect(await adapter.clip(c)).toBe("failed"); // empty body: silently ignored by the server
    expect(await adapter.clip(c)).toBe("failed");
  });

  it("renders the card as on the card after an API clip", async () => {
    const adapter = createCvsAdapter(cvs, deps(async () => jsonResponse(200, feed())));
    adapter.markClipped({ id: "38737_1010630", name: "x", valueCents: 300, pgm: "mfr" });
    const card = document.getElementById("moreDetails_38737_1010630")!.closest("[data-testid=coupon]")!;
    expect(card.querySelector("send-to-card-action button")).toBeNull();
    expect(card.querySelector("on-card .oncard-text")?.textContent).toBe("On card");
    // A late re-render of the card gets patched too.
    const action = card.querySelector("send-to-card-action")!;
    action.innerHTML = '<button class="coupon-action">Send to card</button>';
    await flush();
    expect(card.querySelector("on-card")).not.toBeNull();
    expect(parseCvsCards(document).map((c) => c.id)).toEqual(["133943_555"]);
  });

  it("reports signed in from the feed and signed out on 401 with no cards on the page", async () => {
    const signedIn = deps(async () => jsonResponse(200, feed()));
    expect(await createCvsAdapter(cvs, signedIn).isSignedIn()).toBe(true);
    render("<main><h1>Join ExtraCare</h1></main>");
    const signedOut = deps(async () => jsonResponse(401, { statusCode: 1001 }));
    expect(await createCvsAdapter(cvs, signedOut).isSignedIn()).toBe(false);
  }, 10_000);

  it("stays signed in when the token is stale but the page shows coupons", async () => {
    // The site refreshes its token on page load; an old tab 401s until then.
    const stale = deps(async () => jsonResponse(401, { statusCode: 1005 }));
    expect(await createCvsAdapter(cvs, stale).isSignedIn()).toBe(true);
  });
});

describe("createCvsAdapter page fallback", () => {
  beforeEach(() => {
    render(fixture);
    window.scrollTo = vi.fn(); // jsdom does not implement it
  });

  it("lists the page's unclipped cards", () => {
    const adapter = createCvsAdapter(cvs, deps(async () => jsonResponse(401, {})));
    expect(adapter.getUnclipped().map((c) => c.id)).toEqual(["38737_1010630", "133943_555"]);
  });

  it("clips by clicking Send to card and waiting for the On card state", async () => {
    const adapter = createCvsAdapter(cvs, deps(async () => jsonResponse(401, {})));
    const [coupon] = adapter.getUnclipped();
    const action = document.getElementById("moreDetails_38737_1010630")!
      .closest("[data-testid=coupon]")!
      .querySelector("send-to-card-action")!;
    action.querySelector("button")!.addEventListener("click", () => {
      setTimeout(() => {
        action.innerHTML = '<on-card><span class="oncard-text">On card</span></on-card>';
      }, 50);
    });
    expect(await adapter.clip(coupon)).toBe("ok");
  });

  it("reports failed when the card never changes", async () => {
    const adapter = createCvsAdapter(cvs, deps(async () => jsonResponse(401, {})));
    const [coupon] = adapter.getUnclipped();
    expect(await adapter.clip(coupon)).toBe("failed");
  }, 10_000);

  it("scrolls until no more cards render", async () => {
    const adapter = createCvsAdapter(cvs, deps(async () => jsonResponse(401, {})));
    let scrolls = 0;
    window.scrollTo = vi.fn(() => {
      // The site renders another batch of cards each time the bottom comes into view.
      if (++scrolls <= 2) {
        const card = document.createElement("div");
        card.setAttribute("data-testid", "coupon");
        document.querySelector("main")!.append(card);
      }
    });
    await adapter.loadAll();
    expect(document.querySelectorAll("[data-testid=coupon]")).toHaveLength(5);
    expect(scrolls).toBeGreaterThanOrEqual(3);
  }, 15_000);
});
