import { createClippedMarker } from "../content/clippedMarker";
import { normalizeText, scrollUntilSettled, waitFor } from "../content/loadMore";
import { pgmBreakdown } from "../shared/format";
import { parseJson, readJson, readText } from "../shared/http";
import { errorMessage, log } from "../shared/log";
import { asString, firstLine } from "../shared/text";
import { parseCouponValueCents } from "../shared/value-parse";

import type { StoreAdapter } from "./types";
import type { ClipResult, Coupon, StoreConfig } from "../shared/types";

// The ExtraCare page holds every offer in memory and renders cards as they
// scroll into view; a scroll that adds nothing within this window is the end.
const SCROLL_SETTLE_MS = 1500;
const SCROLL_MAX_MS = 60_000;
const CONFIRM_TIMEOUT_MS = 5000;
const API_TIMEOUT_MS = 15_000;

// The page's own loyalty feed: one POST returns the card cipher plus every
// coupon, on the card or not. The ids and keys are static in the site bundle.
const FEED_PATH = "/retail/client/experience/v2/load/2b3038e6-7c9c-4a0d-8f72-798fe598cfe1";
const FEED_API_KEY = "HGNLXaQhG8CtglhHBvA7XD2TFnso1Scx";
const FEED_BODY = {
  data: {
    id: "",
    idType: "RETAIL_PROFILE_ID_TYPE",
    getCustomerProfileRequest: {
      cardType: "0004",
      extraCareCard: "",
      tables: [],
      xtraCard: ["xtraCardCipherTxt"],
      xtraCare: ["cpns", "mfrCpnAvailPool", "pebAvailPool"],
      xtraCarePrefs: [],
    },
  },
};
// "Send to card" posts here. The server answers 200 with an empty body when
// the routing headers are missing, so all three are required.
const CLIP_PATH = "/RETAGPV3/ExtraCare/V5/createSingleCoupon";
const CLIP_HEADERS = { "content-type": "application/json", src_loc_cd: "0", user_id: "CVS.COM", msg_src_cd: "W" };
const CLIP_REQUEST_HEADER = {
  lineOfBusiness: "RETAIL",
  apiKey: "a2ff75c6-2da7-4299-929d-d670d827ab4a",
  appName: "CVS_WEB",
  channelName: "WEB",
  deviceToken: "d9708df38d23192e",
  deviceType: "DESKTOP",
  responseFormat: "JSON",
  securityType: "apiKey",
  source: "CVS_WEB",
  type: "rdp",
};
const STATUS_LOADED = 0;
const STATUS_ALREADY_ON_CARD = 14;

// Copied from a card the site itself rendered as on the card.
const ON_CARD_HTML =
  '<on-card class="sc-send-to-card-action sc-on-card-h sc-on-card-s hydrated">' +
  '<div class="coupon-action color-dark-gray-2 on-card-wrapper extra-padding sc-on-card" tabindex="-1">' +
  '<img src="https://www.cvs.com/static/images/1y/loyalty/on_card_green.svg" alt="" loading="lazy" width="36" height="36" class="sc-on-card">' +
  '<span class="oncard-text sc-on-card" role="alert">On card</span></div></on-card>';

const CARD_SELECTOR = "[data-testid=coupon]";
const DETAILS_ID_PREFIX = "moreDetails_";

// Cards carry both API ids in their details link: moreDetails_<cmpgnId>_<cpnNbr>.
const cardId = (card: Element): string | null => {
  const id = card.querySelector(`more-details a[id^="${DETAILS_ID_PREFIX}"]`)?.id.slice(DETAILS_ID_PREFIX.length);
  return id && /^\d+_\d+$/.test(id) ? id : null;
};
const findCard = (id: string) => document.getElementById(DETAILS_ID_PREFIX + id)?.closest(CARD_SELECTOR) ?? null;
const sendButton = (card: Element) => card.querySelector<HTMLButtonElement>("send-to-card-action button");
const isOnCard = (card: Element) => card.querySelector("on-card") !== null;

// The clip endpoint always answers 200 with an array; the first entry's
// cpnStatusCd says what happened. Undefined when the body is not that shape.
const clipStatusCode = (body: unknown): unknown =>
  Array.isArray(body) ? (body[0] as { cpnStatusCd?: unknown } | undefined)?.cpnStatusCd : undefined;

export const parseCvsCards = (root: ParentNode): Coupon[] => {
  const coupons: Coupon[] = [];
  root.querySelectorAll(CARD_SELECTOR).forEach((card, index) => {
    if (!sendButton(card) || isOnCard(card)) return;
    const name =
      normalizeText(card.querySelector("h3 .visually-hidden")) ||
      normalizeText(card.querySelector("h3")) ||
      "Unnamed coupon";
    coupons.push({ id: cardId(card) ?? `cvs-${index}`, name, valueCents: parseCouponValueCents(name) });
  });
  return coupons;
};

// One entry of the feed's coupon lists (only the fields we read).
interface CvsOffer {
  cmpgnId?: unknown;
  cpnNbr?: unknown;
  cpnSeqNbr?: unknown; // only once the coupon is on the card
  cpnDsc?: unknown;
  mfrInd?: unknown;
  mfrOfferValueDsc?: unknown;
  mfrOfferBrandName?: unknown;
}

export interface CvsFeed {
  unclipped: Coupon[];
  onCard: number;
  card: string; // cipher the clip endpoint wants as extraCareCard
}

interface FeedRequest {
  status: number;
  feed: CvsFeed | null; // null when the body is not a feed (signed out, feed down)
  body: unknown;
}

const offerId = (offer: CvsOffer) => {
  const cmpgn = asString(offer.cmpgnId);
  const cpn = asString(offer.cpnNbr);
  return cmpgn && cpn ? `${cmpgn}_${cpn}` : null;
};

// Parses the loyalty feed. Null when the body is not a feed (e.g. the 401
// {"statusCode":1001} for a signed-out session).
export const parseCvsFeed = (json: unknown): CvsFeed | null => {
  const body = json as { statusCode?: unknown; data?: { getEcCustomerProfile?: unknown } } | null;
  const profile = body?.data?.getEcCustomerProfile as
    | { couponCategories?: unknown; xtraCard?: { xtraCardCipherTxt?: unknown }; xtraCare?: { cpns?: unknown } }
    | undefined;
  if (body?.statusCode !== "0000" || !profile?.couponCategories || typeof profile.couponCategories !== "object") {
    return null;
  }
  const onCard = new Set<string>();
  for (const offer of Array.isArray(profile.xtraCare?.cpns) ? (profile.xtraCare.cpns as CvsOffer[]) : []) {
    const id = offer && offerId(offer);
    if (id) onCard.add(id);
  }
  const seen = new Set<string>();
  const unclipped: Coupon[] = [];
  for (const list of Object.values(profile.couponCategories as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    for (const offer of list as CvsOffer[]) {
      if (!offer || typeof offer !== "object") continue;
      const id = offerId(offer);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (onCard.has(id) || offer.cpnSeqNbr !== undefined) continue;
      const name =
        `${asString(offer.mfrOfferValueDsc)} ${asString(offer.mfrOfferBrandName)}`.trim() ||
        firstLine(offer.cpnDsc) ||
        "Unnamed coupon";
      unclipped.push({
        id,
        name,
        valueCents: parseCouponValueCents(name),
        pgm: offer.mfrInd === "Y" ? "mfr" : "cvs",
      });
    }
  }
  return { unclipped, onCard: onCard.size, card: asString(profile.xtraCard?.xtraCardCipherTxt) };
};

export interface CvsDeps {
  fetch: typeof fetch;
}

export const createCvsAdapter = (
  store: StoreConfig,
  deps: CvsDeps = { fetch: (...a) => window.fetch(...a) }
): StoreAdapter => {
  // The cipher comes with the feed; kept for clips of the same run.
  let card = "";

  const api = (path: string, init: RequestInit) =>
    deps.fetch(`${location.origin}${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      ...init,
    });

  // One POST returns the card cipher plus every coupon; the cipher is kept
  // for the clips that follow.
  const requestFeed = async (): Promise<FeedRequest> => {
    const response = await api(FEED_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": FEED_API_KEY },
      body: JSON.stringify(FEED_BODY),
    });
    const body = await readJson(response);
    const feed = parseCvsFeed(body);
    if (feed?.card) card = feed.card;
    return { status: response.status, feed, body };
  };

  // Resolves null when the session is signed out or the feed is down.
  const fetchFeed = async (): Promise<CvsFeed | null> => {
    const started = Date.now();
    try {
      const { status, feed, body } = await requestFeed();
      if (!feed) {
        log.warn(`loyalty feed: HTTP ${status}, ${JSON.stringify(body ?? "").slice(0, 200)} (${Date.now() - started}ms)`);
        return null;
      }
      log.info(
        `loyalty feed: ${feed.unclipped.length} unclipped ${pgmBreakdown(feed.unclipped)}, ` +
          `${feed.onCard} on card, ${Date.now() - started}ms`
      );
      return feed;
    } catch (err) {
      log.warn(`loyalty feed: ${errorMessage(err)} (${Date.now() - started}ms)`);
      return null;
    }
  };

  const clipViaApi = async (coupon: Coupon): Promise<ClipResult> => {
    if (!card && !(await fetchFeed())) return "failed";
    const [cmpgnId, cpnSkuNbr] = coupon.id.split("_");
    let response: Response;
    try {
      response = await api(CLIP_PATH, {
        method: "POST",
        headers: CLIP_HEADERS,
        body: JSON.stringify({ cmpgnId, cpnSkuNbr, extraCareCard: card, cardType: "0006", header: CLIP_REQUEST_HEADER }),
      });
    } catch (err) {
      log.warn(`clip api: no response for ${coupon.id}:`, err);
      return "failed";
    }
    if (response.status === 429) return "rate_limited";
    const text = await readText(response);
    const status = response.status === 200 ? clipStatusCode(parseJson(text)) : undefined;
    if (status === STATUS_LOADED) return "ok";
    if (status === STATUS_ALREADY_ON_CARD) {
      log.info(`clip api: ${coupon.id} was already on the card`);
      return "ok";
    }
    log.warn(`clip api: HTTP ${response.status} for ${coupon.id}: ${text.trim().slice(0, 200) || "(empty body)"}`);
    return "failed";
  };

  // Swaps the site's button for its own "On card" state.
  const renderOnCard = (id: string): boolean => {
    const card = findCard(id);
    const action = card?.querySelector("send-to-card-action");
    if (!card || !action || !sendButton(card)) return false;
    action.innerHTML = ON_CARD_HTML;
    return true;
  };
  const marker = createClippedMarker(renderOnCard);

  const pageHasCoupons = () => document.querySelector(CARD_SELECTOR) !== null || document.querySelector("[redis-key]") !== null;

  return {
    store,
    isSignedIn: async () => {
      try {
        const { status, feed } = await requestFeed();
        if (feed) return true;
        // The site only refreshes its access token on page load, so a tab
        // left open 401s here while still showing the user's coupons; the
        // page scan (and the site's own buttons) still work in that case.
        if (status === 401 && pageHasCoupons()) {
          log.warn("loyalty feed rejected the session token; falling back to the page");
          return true;
        }
      } catch {
        /* fall back to reading the page */
      }
      // Signed out, the URL serves a marketing page without any cards.
      return waitFor(pageHasCoupons, { timeoutMs: 6000, pollMs: 250 });
    },
    loadAll: () =>
      scrollUntilSettled({
        count: () => document.querySelectorAll(CARD_SELECTOR).length,
        settleMs: SCROLL_SETTLE_MS,
        maxMs: SCROLL_MAX_MS,
      }),
    getUnclipped: () => parseCvsCards(document),
    fetchUnclipped: async () => (await fetchFeed())?.unclipped ?? null,
    clip: async (coupon) => {
      if (coupon.pgm) return clipViaApi(coupon);

      // Page-scan fallback: click the site's button and wait for "On card".
      const card = findCard(coupon.id) ?? document.querySelectorAll(CARD_SELECTOR)[Number(coupon.id.replace("cvs-", ""))];
      const button = card && sendButton(card);
      if (!card || !button) {
        log.warn(`no Send to card button on the page for ${coupon.id}`);
        return "failed";
      }
      button.click();
      return (await waitFor(() => isOnCard(card), { timeoutMs: CONFIRM_TIMEOUT_MS, pollMs: 100 })) ? "ok" : "failed";
    },
    markClipped: (coupon) => {
      if (coupon.pgm) marker.mark(coupon.id); // otherwise the site updated its own card
    },
  };
};
