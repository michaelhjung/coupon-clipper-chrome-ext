import { beforeEach, describe, expect, it, vi } from "vitest";

import { clickLoadMoreUntilSettled } from "../src/content/loadMore";

const addCard = () => {
  const card = document.createElement("article");
  card.innerHTML = "<h3>Coupon</h3><button><p>Clip</p></button>";
  document.querySelector("main")!.append(card);
};

const addLoadMore = (onClick: (button: HTMLButtonElement) => void) => {
  const button = document.createElement("button");
  button.textContent = "Load more";
  button.addEventListener("click", () => onClick(button));
  document.body.append(button);
  return button;
};

describe("clickLoadMoreUntilSettled", () => {
  beforeEach(() => {
    document.body.innerHTML = "<main></main>";
    addCard();
    window.scrollTo = vi.fn(); // jsdom does not implement it
  });

  it("keeps going when the button briefly disappears while the next page loads", async () => {
    let pages = 0;
    const serve = (button: HTMLButtonElement) => {
      button.remove();
      pages++;
      // Slow server: the button is gone for longer than the old 1.5s-style
      // settle window, then the page grows and the button comes back.
      setTimeout(() => {
        addCard();
        if (pages < 3) addLoadMore(serve);
      }, 400);
    };
    addLoadMore(serve);
    const clicks = await clickLoadMoreUntilSettled({
      buttonText: "load more",
      settleMs: 1000,
      maxMs: 10_000,
      waitBetweenClicksMs: 10,
    });
    expect(clicks).toBe(3);
    expect(document.querySelectorAll("article")).toHaveLength(4);
  });

  it("stops when clicking no longer adds anything to the page", async () => {
    // The button never goes away and never loads anything (end of list).
    addLoadMore(() => undefined);
    const started = Date.now();
    const clicks = await clickLoadMoreUntilSettled({
      buttonText: "load more",
      settleMs: 300,
      maxMs: 10_000,
      waitBetweenClicksMs: 10,
    });
    expect(clicks).toBe(2);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("gives up quickly when there is no button at all, without waiting the full settle", async () => {
    const started = Date.now();
    const clicks = await clickLoadMoreUntilSettled({
      buttonText: "load more",
      settleMs: 8000,
      maxMs: 20_000,
      waitBetweenClicksMs: 10,
    });
    expect(clicks).toBe(0);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
