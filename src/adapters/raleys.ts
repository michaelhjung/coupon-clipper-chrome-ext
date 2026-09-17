import { createClippedMarker } from "../content/clippedMarker";
import { clickLoadMoreUntilSettled, elementText, waitFor } from "../content/loadMore";
import { raleysBridge } from "../content/raleysBridge";
import { pgmBreakdown } from "../shared/format";
import { errorMessage, log } from "../shared/log";
import { parseCouponValueCents } from "../shared/value-parse";

import type { StoreAdapter } from "./types";
import type { RaleysBridge } from "../content/raleysBridge";
import type { ClipResult, Coupon, StoreConfig } from "../shared/types";

const CONFIRM_TIMEOUT_MS = 1500;
const LOAD_MORE_SETTLE_MS = 8000;
const LOAD_MORE_MAX_MS = 180_000;
// A click should fire its request at once; the server can be slow to answer.
const REQUEST_TIMEOUT_MS = 3000;
const RESPONSE_TIMEOUT_MS = 20_000;
const SIGN_IN_TEXTS = ["sign in", "log in", "login"];
// Body of the 400 the accept endpoints return for a dead coupon.
const EXPIRED_MESSAGE = /expired|no longer valid/i;

// The site's own gallery pages through this endpoint 30 at a time.
const OFFERS_PAGE_SIZE = 30;
const MAX_OFFER_PAGES = 100;
// Raley's gateway intermittently stalls for 10-50s (it 504s its own
// favicon). Requests are idempotent, so cut them off and try again.
const API_TIMEOUT_MS = 8000;
const API_ATTEMPTS = 3;

const isClipButton = (b: HTMLButtonElement) => elementText(b.querySelector("p")) === "clip";

// Copied from a button the site itself rendered as clipped.
const CLIPPED_BUTTON_CLASSES = [
  "border-2",
  "focus-visible:outline-wellness-300",
  "border-wellness-300",
  "!bg-white",
  "focus-visible:border-wellness-300",
  "focus-visible:outline-none",
];
const CLIPPED_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" priority="true" width="32" height="32" ' +
  'alt="check-circle" stroke="#4b5358" class="inline h-[1.125rem] w-[1.125rem] fill-wellness-300 stroke-none">' +
  '<circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2.5"></circle>' +
  '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
  'd="m7 12 2.89 2.89v0c.061.061.159.061.22 0v0L16 9"></path></svg>';

const clipButtons = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(isClipButton);

// Each card is a div whose id is the offer id and whose button is labelled
// "Clip <price> <description>". Older markup had neither; fall back to the
// position and nearest container.
const describe = (button: HTMLButtonElement, index: number): Coupon => {
  const card = button.closest<HTMLElement>("[id]");
  const label = (button.getAttribute("aria-label") ?? "").replace(/^clip\s+/i, "").trim();
  if (card?.id && label) {
    return { id: card.id, name: label, valueCents: parseCouponValueCents(label) };
  }
  const container = button.closest("article, li, div");
  const name =
    label ||
    (container?.querySelector("h1, h2, h3, h4, h5, h6")?.textContent ?? "").trim() ||
    "Unnamed coupon";
  return {
    id: `raleys-${index}`,
    name,
    valueCents: parseCouponValueCents(label || (container?.textContent ?? "")),
  };
};

const hasSignInCta = () =>
  Array.from(document.querySelectorAll("a, button")).some((el) =>
    SIGN_IN_TEXTS.includes(elementText(el))
  );

interface RaleysOffer {
  ExtPromotionId?: unknown;
  ExtBadgeTypeCode?: unknown; // "SomethingExtra" | "WeeklyExclusive" | "mfg"
  RewardType?: unknown; // "DollarOff" | "PricePoint"
  Headline?: unknown;
  SubHeadline?: unknown;
  IsAccepted?: unknown;
  DiscountAmountType?: unknown;
  DiscountAmount?: unknown;
}

export interface RaleysOffersPage {
  unclipped: Coupon[];
  count: number; // offers on this page, clipped or not
  total: number; // offers in the whole gallery
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const firstLine = (v: unknown) => str(v).split("\n")[0].replace(/\s+/g, " ").trim();

// Manufacturer coupons restate one headline in the other ("Save $3 on ONE
// Tide…" / "ONE Tide…"); keep the fuller one. Store offers split price and
// product across the two, so join them.
const joinHeadlines = (headline: string, sub: string) => {
  const restates = (a: string, b: string) => b.length >= 12 && a.includes(b.slice(0, 20));
  if (restates(sub, headline)) return sub.length > headline.length ? sub : headline;
  if (restates(headline, sub)) return headline;
  return `${headline} ${sub}`.trim();
};

// One page of GET /api/offers/get-offers. Null when the body is not an
// offers page (e.g. {"message":"Not Authorized"}).
export const parseRaleysOffersPage = (json: unknown): RaleysOffersPage | null => {
  const body = json as { data?: unknown; total?: unknown } | null;
  if (!body || !Array.isArray(body.data) || typeof body.total !== "number") return null;
  const unclipped: Coupon[] = [];
  for (const offer of body.data as RaleysOffer[]) {
    if (!offer || typeof offer !== "object" || offer.IsAccepted === true) continue;
    const id = str(offer.ExtPromotionId);
    if (!id) continue;
    // Manufacturer coupons carry legal text after a line break.
    const headline = firstLine(offer.Headline);
    const sub = firstLine(offer.SubHeadline);
    const name = joinHeadlines(headline, sub) || "Unnamed coupon";
    const pgm = str(offer.ExtBadgeTypeCode);
    const dollarsOff =
      offer.RewardType === "DollarOff" && offer.DiscountAmountType === "Dollar" &&
      typeof offer.DiscountAmount === "number" && offer.DiscountAmount > 0
        ? Math.round(offer.DiscountAmount * 100)
        : null;
    unclipped.push({
      id,
      name,
      valueCents: dollarsOff ?? (offer.RewardType === "DollarOff" ? parseCouponValueCents(name) : null),
      pgm: pgm || undefined,
    });
  }
  return { unclipped, count: body.data.length, total: body.total };
};

export interface RaleysDeps {
  bridge: RaleysBridge;
  fetch: typeof fetch;
}

export const createRaleysAdapter = (
  store: StoreConfig,
  deps: RaleysDeps = { bridge: raleysBridge, fetch: (...a) => window.fetch(...a) }
): StoreAdapter => {
  // The site re-renders cards, so prefer looking the button up by card id at
  // clip time; the element seen at scan time is only a fallback.
  const elements = new Map<string, HTMLButtonElement>();
  const findButton = (coupon: Coupon): HTMLButtonElement | null => {
    const current = document.getElementById(coupon.id)?.querySelector("button");
    if (current && isClipButton(current)) return current;
    const seen = elements.get(coupon.id);
    return seen?.isConnected ? seen : null;
  };
  let warnedNoBridge = false;

  const api = async (path: string, init?: RequestInit): Promise<Response> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= API_ATTEMPTS; attempt++) {
      try {
        return await deps.fetch(`${location.origin}${path}`, {
          credentials: "include",
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
          ...init,
        });
      } catch (err) {
        lastError = err;
        const why = err instanceof Error && /Abort|Timeout/.test(err.name) ? "timed out" : "failed";
        log.warn(`${path} ${why} (attempt ${attempt}/${API_ATTEMPTS})`);
      }
    }
    throw lastError;
  };

  const fetchOffersPage = async (offset: number): Promise<RaleysOffersPage> => {
    const response = await api(`/api/offers/get-offers?type=&offset=${offset}&rows=${OFFERS_PAGE_SIZE}`);
    if (response.status !== 200) throw new Error(`HTTP ${response.status} at offset ${offset}`);
    const json = await response.json().catch(() => null);
    const page = parseRaleysOffersPage(json);
    if (!page) throw new Error(`unexpected body at offset ${offset}, keys=${JSON.stringify(Object.keys(json ?? {}))}`);
    return page;
  };

  // The first page says how many offers there are; the rest are fetched at
  // once rather than one slow round trip at a time.
  const fetchUnclipped = async (): Promise<Coupon[] | null> => {
    const started = Date.now();
    let pages: RaleysOffersPage[];
    try {
      const first = await fetchOffersPage(0);
      const offsets: number[] = [];
      for (let o = first.count; o < first.total && offsets.length < MAX_OFFER_PAGES; o += OFFERS_PAGE_SIZE) {
        offsets.push(o);
      }
      pages = [first, ...(await Promise.all(offsets.map(fetchOffersPage)))];
    } catch (err) {
      log.warn(`offers api: ${errorMessage(err)} (${Date.now() - started}ms)`);
      return null;
    }
    const unclipped = pages.flatMap((p) => p.unclipped);
    log.info(
      `offers api: ${pages[0].total} offers, ${unclipped.length} unclipped ${pgmBreakdown(unclipped)} ` +
        `in ${pages.length} page(s), ${Date.now() - started}ms`
    );
    return unclipped;
  };

  // Manufacturer coupons and the store's own offers live behind different
  // endpoints; each rejects the other's ids.
  const clipViaApi = async (coupon: Coupon, pgm: string): Promise<ClipResult> => {
    const path = pgm === "mfg" ? "/api/offers/accept-coupons" : "/api/offers/accept";
    let response: Response;
    try {
      response = await api(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId: coupon.id, offerType: pgm }),
      });
    } catch (err) {
      log.warn(`clip api: no response for ${coupon.id} (${pgm}):`, err);
      return "failed";
    }
    if (response.status === 429) return "rate_limited";
    const text = await response.text().catch(() => "");
    if (response.status === 200 && text.trim() === "true") return "ok";
    if (response.status === 400 && EXPIRED_MESSAGE.test(text)) {
      // The gallery lists coupons the provider has already pulled; the
      // site's own button gets the same answer.
      log.info(`clip api: ${coupon.id} (${pgm}) has expired on the server`);
      return "expired";
    }
    log.warn(`clip api: HTTP ${response.status} for ${coupon.id} (${pgm}): ${text.slice(0, 200)}`);
    return "failed";
  };

  // Mirrors the site's own clipped button: green outline, white fill,
  // green label, check-circle icon in place of the scissors.
  const renderClipped = (id: string): boolean => {
    const button = document.getElementById(id)?.querySelector("button");
    if (!button || !isClipButton(button)) return false;
    button.classList.remove("border", "border-transparent", "focus-visible:outline-primary-700");
    button.classList.add(...CLIPPED_BUTTON_CLASSES);
    const label = button.querySelector("p");
    if (label) {
      label.textContent = "Clipped";
      label.classList.add("text-wellness-300");
    }
    const icon = button.querySelector("svg");
    if (icon) {
      const template = document.createElement("template");
      template.innerHTML = CLIPPED_ICON_SVG;
      icon.replaceWith(template.content.firstElementChild!);
    }
    return true;
  };
  const marker = createClippedMarker(renderClipped);

  return {
    store,
    isSignedIn: async () => {
      try {
        const response = await api("/api/auth/session");
        const json = (await response.json().catch(() => null)) as { user?: unknown } | null;
        return Boolean(json?.user);
      } catch {
        /* fall back to reading the page */
      }
      await waitFor(() => clipButtons().length > 0 || hasSignInCta(), { timeoutMs: 6000, pollMs: 250 });
      return clipButtons().length > 0 || !hasSignInCta();
    },
    // The site hides "Load more" while it fetches the next page, and the
    // server can take several seconds under load, so give each click a long
    // settle window and let content growth (not a click cap) decide the end.
    loadAll: () =>
      clickLoadMoreUntilSettled({
        buttonText: "load more",
        settleMs: LOAD_MORE_SETTLE_MS,
        maxMs: LOAD_MORE_MAX_MS,
        waitBetweenClicksMs: 500,
      }),
    getUnclipped: () => {
      elements.clear();
      return clipButtons().map((button, i) => {
        const coupon = describe(button, i);
        elements.set(coupon.id, button);
        return coupon;
      });
    },
    fetchUnclipped,
    clip: async (coupon) => {
      if (coupon.pgm) return clipViaApi(coupon, coupon.pgm);

      // Page-scan fallback: click the site's button and confirm.
      const button = findButton(coupon);
      // A card the site has removed cannot be clicked; reporting it clipped
      // would hide the miss until the next run.
      if (!button) {
        log.warn(`no clip button on the page for ${coupon.id}`);
        return "failed";
      }
      if (deps.bridge.isReady()) {
        const response = deps.bridge.nextClipResponse({
          requestTimeoutMs: REQUEST_TIMEOUT_MS,
          responseTimeoutMs: RESPONSE_TIMEOUT_MS,
        });
        const before = elementText(button);
        button.click();
        const result = await response;
        if (result === null) {
          log.warn(
            `clip request did not complete for ${coupon.id} ` +
              `(button "${before}" → "${elementText(button)}", connected=${button.isConnected})`
          );
          return "failed";
        }
        if (result.status >= 200 && result.status < 300) return "ok";
        if (result.status === 429) return "rate_limited";
        log.warn(`clip request returned HTTP ${result.status} for ${coupon.id}: ${result.body}`);
        return "failed";
      }
      // Without the bridge, fall back to watching the button. This cannot
      // tell a rejected clip from an accepted one.
      if (!warnedNoBridge) {
        warnedNoBridge = true;
        log.warn("raleys bridge not ready; confirming clips from the button state only");
      }
      const initial = elementText(button);
      button.click();
      const changed = () =>
        !button.isConnected ||
        button.disabled ||
        elementText(button) !== initial ||
        /clipped|activated|added/i.test(button.closest("article, li, div")?.textContent ?? "");
      return (await waitFor(changed, { timeoutMs: CONFIRM_TIMEOUT_MS, pollMs: 100 })) ? "ok" : "failed";
    },
    markClipped: (coupon) => {
      if (coupon.pgm) marker.mark(coupon.id); // otherwise the site updated its own button
    },
  };
};
