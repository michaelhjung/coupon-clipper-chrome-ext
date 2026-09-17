export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Polls until `ready` is true; resolves false on timeout.
export const waitFor = async (
  ready: () => boolean,
  o: { timeoutMs: number; pollMs: number }
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < o.timeoutMs) {
    if (ready()) return true;
    await sleep(o.pollMs);
  }
  return ready();
};

// innerText respects visibility but is undefined in jsdom; fall back to textContent.
export const normalizeText = (el: Element | null | undefined): string =>
  ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();

export const elementText = (el: Element | null | undefined): string =>
  normalizeText(el).toLowerCase();

export const findButtonByText = (text: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => elementText(b) === text
  ) ?? null;

export interface LoadMoreOptions {
  buttonText: string;
  // How long to wait for a click to add content, and how long the button may
  // be missing (sites hide it while a page loads) before we call it done.
  settleMs: number;
  maxMs: number;
  waitBetweenClicksMs: number;
}

const POLL_MS = 100;
// Consecutive clicks that add nothing before we treat the list as complete.
const IDLE_CLICKS = 2;
// A page with no button at all is done; only wait this long for one to appear.
const INITIAL_GRACE_MS = 2000;

// Any new card bumps the DOM node count regardless of markup.
const domSize = () => document.body.getElementsByTagName("*").length;

// Clicks "load more" until the button stays gone for `settleMs` or clicks
// stop adding content. After each click we wait for the page to grow rather
// than a fixed delay, so a slow server does not end the run early.
export const clickLoadMoreUntilSettled = async (o: LoadMoreOptions): Promise<number> => {
  const start = Date.now();
  let lastSeen = Date.now();
  let clicks = 0;
  let idleClicks = 0;
  while (Date.now() - start < o.maxMs) {
    const button = findButtonByText(o.buttonText);
    if (button) {
      const before = domSize();
      button.click();
      clicks++;
      lastSeen = Date.now();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      const clickedAt = Date.now();
      while (Date.now() - clickedAt < o.settleMs && domSize() <= before) {
        await sleep(POLL_MS);
      }
      if (domSize() > before) {
        idleClicks = 0;
      } else if (++idleClicks >= IDLE_CLICKS) {
        return clicks;
      }
      await sleep(o.waitBetweenClicksMs);
    } else if (Date.now() - lastSeen >= (clicks === 0 ? Math.min(o.settleMs, INITIAL_GRACE_MS) : o.settleMs)) {
      return clicks;
    } else {
      await sleep(POLL_MS);
    }
  }
  return clicks;
};

export interface ScrollOptions {
  // Whatever the page adds as it renders, e.g. the number of cards.
  count: () => number;
  settleMs: number;
  maxMs: number;
}

// For pages that hold every offer in memory and only render cards as they
// scroll into view: keep jumping to the bottom until a scroll adds nothing.
export const scrollUntilSettled = async (o: ScrollOptions): Promise<number> => {
  const start = Date.now();
  let scrolls = 0;
  let idleScrolls = 0;
  while (Date.now() - start < o.maxMs) {
    const before = o.count();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    scrolls++;
    const scrolledAt = Date.now();
    while (Date.now() - scrolledAt < o.settleMs && o.count() <= before) {
      await sleep(POLL_MS);
    }
    if (o.count() > before) {
      idleScrolls = 0;
    } else if (++idleScrolls >= IDLE_CLICKS) {
      return scrolls;
    }
  }
  return scrolls;
};
