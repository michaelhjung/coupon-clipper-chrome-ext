import { createClippedMarker } from "../content/clippedMarker";
import { clickLoadMoreUntilSettled, elementText, normalizeText } from "../content/loadMore";
import { getSession, initPageBridge, waitForSession } from "../content/pageBridge";
import { pgmBreakdown } from "../shared/format";
import { log } from "../shared/log";
import { parseCouponValueCents } from "../shared/value-parse";

import type { StoreAdapter } from "./types";
import type { AlbertsonsSession } from "../content/pageBridge";
import type { ClipResult, Coupon, StoreConfig } from "../shared/types";

// Public web keys the Albertsons site ships; used only if page-script could
// not read them from the page.
const FALLBACK_CLIENT_ID = "306b9569-2a31-4fb9-93aa-08332ba3c55d";
const FALLBACK_CLIENT_SECRET = "N4tK3pW7pP6nB4kL6vN4kW0rS5lE4qH2fY0aB2rK1eP5gK4yV5";
const FALLBACK_STORE_ID = "908";
const PGM_CANDIDATES = ["MF", "SC", "CC", "PD", "manufacturerCoupons"];
const CLIP_TEXTS = new Set(["clip coupon", "activate"]);

export const parseAlbertsonsCoupons = (root: ParentNode): Coupon[] => {
  const coupons: Coupon[] = [];
  for (const button of root.querySelectorAll<HTMLButtonElement>('button[id^="couponAddBtn"]')) {
    if (!CLIP_TEXTS.has(elementText(button))) continue;
    const match = button.id.match(/^couponAddBtn(\d+)$/);
    const card = button.closest(".coupon-card__card-body");
    if (!match || !card) continue;

    const href =
      card
        .querySelector("a.coupon-card-offer-details[href*='offer-details']")
        ?.getAttribute("href") ?? "";
    const pgm = href.match(/([A-Z]{2})(?:\.html)?/)?.[1];
    const title = normalizeText(card.querySelector("h5.cpn-title"));
    const price = normalizeText(card.querySelector('[class*="price"]'));

    coupons.push({
      id: match[1],
      name: title || "Unnamed coupon",
      valueCents: parseCouponValueCents(`${price} ${title}`),
      pgm: pgm || undefined,
    });
  }
  return coupons;
};

// One entry of the companiongalleryoffer response (only the fields we read).
interface GalleryOffer {
  offerId?: unknown;
  name?: unknown;
  offerPgm?: unknown;
  offerPrice?: unknown;
  status?: unknown; // "U" unclipped, "C" clipped
  deleted?: unknown;
}

// Parses GET /abs/pub/xapi/offers/companiongalleryoffer. Returns null when the
// body is not the shape we expect so callers can fall back to the DOM.
export const parseAlbertsonsOffers = (json: unknown): Coupon[] | null => {
  const gallery = (json as { companionGalleryOffer?: unknown } | null)?.companionGalleryOffer;
  if (!gallery || typeof gallery !== "object" || Array.isArray(gallery)) return null;
  const coupons: Coupon[] = [];
  for (const offer of Object.values(gallery as Record<string, GalleryOffer>)) {
    if (!offer || typeof offer !== "object") continue;
    if (offer.status !== "U" || offer.deleted === true) continue;
    const id = String(offer.offerId ?? "");
    if (!id) continue;
    const name = typeof offer.name === "string" && offer.name ? offer.name : "Unnamed coupon";
    const price = typeof offer.offerPrice === "string" ? offer.offerPrice : "";
    const pgm = typeof offer.offerPgm === "string" ? offer.offerPgm : "";
    coupons.push({
      id,
      name,
      valueCents: parseCouponValueCents(`${price} ${name}`),
      pgm: pgm || undefined,
    });
  }
  return coupons;
};

// Reorders API coupons to match the cards currently rendered on the page so
// the user can watch the clips land top to bottom; offers the page has not
// rendered yet keep their API order at the end. One DOM query, no requests.
export const orderByPage = (coupons: Coupon[], root: ParentNode = document): Coupon[] => {
  const position = new Map<string, number>();
  root.querySelectorAll<HTMLButtonElement>('button[id^="couponAddBtn"]').forEach((b, i) => {
    const id = b.id.slice("couponAddBtn".length);
    if (!position.has(id)) position.set(id, i);
  });
  if (position.size === 0) return coupons;
  const rank = (c: Coupon) => position.get(c.id) ?? Number.MAX_SAFE_INTEGER;
  return coupons
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
};

export interface AlbertsonsDeps {
  fetch: typeof fetch;
}

export const createAlbertsonsAdapter = (
  store: StoreConfig,
  deps: AlbertsonsDeps = { fetch: (...a) => window.fetch(...a) }
): StoreAdapter => {
  const apiHeaders = (session: AlbertsonsSession | null) => {
    const token = session?.token ?? "";
    return {
      "Content-Type": "application/json",
      SWY_SSO_TOKEN: token,
      "X-IBM-Client-Id": session?.clientId || FALLBACK_CLIENT_ID,
      "X-IBM-Client-Secret": session?.clientSecret || FALLBACK_CLIENT_SECRET,
      "X-SWY_API_KEY": "emjou",
      "X-SWY_BANNER": "safeway",
      "X-SWY_VERSION": "1.0",
      "X-swyConsumerDirectoryPro": token,
      "x-swy-correlation-id": session?.correlationId || "",
    };
  };

  // The site loads its whole gallery from this one endpoint; using it skips
  // the "Load more" clicking entirely.
  const fetchUnclipped = async (): Promise<Coupon[] | null> => {
    const session = getSession();
    const storeId = session?.storeId || FALLBACK_STORE_ID;
    const url =
      `${location.origin}/abs/pub/xapi/offers/companiongalleryoffer` +
      `?storeId=${storeId}&rand=${Date.now()}&includeRedmBonusPathFPOffers=true`;
    const started = Date.now();
    try {
      const response = await deps.fetch(url, {
        method: "GET",
        credentials: "include",
        headers: apiHeaders(session),
      });
      const ms = Date.now() - started;
      if (response.status !== 200) {
        log.warn(`offers api: HTTP ${response.status} in ${ms}ms (storeId=${storeId})`);
        return null;
      }
      const json = await response.json().catch(() => null);
      const coupons = parseAlbertsonsOffers(json);
      if (!coupons) {
        log.warn(`offers api: unexpected body in ${ms}ms, keys=${JSON.stringify(Object.keys(json ?? {}))}`);
        return null;
      }
      const gallery = (json as { companionGalleryOffer: Record<string, unknown> }).companionGalleryOffer;
      const ordered = orderByPage(coupons);
      const onPage = ordered.filter((c) => document.getElementById(`couponAddBtn${c.id}`)).length;
      log.info(
        `offers api: ${Object.keys(gallery).length} offers, ${coupons.length} unclipped ` +
          `${pgmBreakdown(coupons)} in ${ms}ms (storeId=${storeId}, token=${session?.token ? "yes" : "no"}, ` +
          `${onPage} rendered on page)`
      );
      return ordered;
    } catch (err) {
      log.warn(`offers api: request failed in ${Date.now() - started}ms:`, err);
      return null;
    }
  };

  // Replaces the card's action buttons with the site's own "Clipped" markup.
  const renderClipped = (id: string): boolean => {
    const container = document
      .getElementById(`couponAddBtn${id}`)
      ?.closest("loyalty-card-action-buttons");
    if (!container) return false;
    container.innerHTML = `
      <div>
        <div class="clipped" aria-describedby="coupon-price-${id} coupon-title-${id} coupon-description-${id}">
          <span class="clipped__checkmark svg-checkmark"></span>
          <span class="clipped__label"><span class="sr-only">Coupon has already been </span>Clipped</span>
        </div>
      </div>`;
    return true;
  };
  const marker = createClippedMarker(renderClipped);

  const clipOnce = async (coupon: Coupon, pgm: string): Promise<ClipResult | "next"> => {
    const session = getSession();
    const storeId = session?.storeId || FALLBACK_STORE_ID;
    const url = `${location.origin}/abs/pub/web/j4u/api/offers/clip?storeId=${storeId}`;
    const response = await deps.fetch(url, {
      method: "POST",
      headers: apiHeaders(session),
      body: JSON.stringify({
        items: [
          { clipType: "C", itemId: coupon.id, itemType: pgm },
          { clipType: "L", itemId: coupon.id, itemType: pgm },
        ],
      }),
    });
    if (response.status === 429) return "rate_limited";
    const json = await response.json().catch(() => null);
    return json?.items?.[0]?.status === 1 ? "ok" : "next";
  };

  return {
    store,
    init: initPageBridge,
    isSignedIn: async () => Boolean((await waitForSession(6000))?.token),
    loadAll: () =>
      clickLoadMoreUntilSettled({
        buttonText: "load more",
        settleMs: 1500,
        maxMs: 60_000,
        waitBetweenClicksMs: 300,
      }),
    getUnclipped: () => parseAlbertsonsCoupons(document),
    fetchUnclipped,
    clip: async (coupon) => {
      const pgms = coupon.pgm ? [coupon.pgm] : PGM_CANDIDATES;
      for (const pgm of pgms) {
        const result = await clipOnce(coupon, pgm);
        if (result !== "next") return result;
      }
      return "failed";
    },
    markClipped: (coupon) => {
      marker.mark(coupon.id);
      // The site caches the gallery here; drop it so a reload re-fetches and
      // shows the clipped state instead of stale "Clip" buttons.
      localStorage.removeItem("abJ4uCoupons");
    },
  };
};
