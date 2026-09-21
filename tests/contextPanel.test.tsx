import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetChromeMock } from "./setup";
import { ContextPanel } from "../src/popup/components/ContextPanel";
import { getCouponPageUrl, getStoreByName } from "../src/shared/constants";
import { DEFAULT_SETTINGS } from "../src/shared/storage";

import type { ActiveTabInfo } from "../src/popup/useActiveTab";
import type { State } from "../src/shared/types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const state: State = {
  activeRuns: {},
  lastRuns: {},
  lastCounts: {},
  stats: { clipsByStore: {}, savingsByStore: {} },
  settings: DEFAULT_SETTINGS,
  signedOutTabs: {},
  loadResults: {},
};

const tab = { id: 7, windowId: 3 } as chrome.tabs.Tab;
const safeway = getStoreByName("Safeway")!;

const infoFor = (kind: "unsupported" | "store" | "coupons"): ActiveTabInfo => ({
  tab,
  store: kind === "unsupported" ? undefined : safeway,
  onCouponPage: kind === "coupons",
  loaded: true,
});

let container: HTMLDivElement;
let root: Root;

const mount = (info: ActiveTabInfo) =>
  act(() => {
    root.render(<ContextPanel info={info} state={state} onPending={() => {}} />);
  });

const picker = () => container.querySelector("select") as HTMLSelectElement | null;
const goButton = () =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Go") ?? null;

beforeEach(() => {
  resetChromeMock();
  (globalThis as any).chrome.tabs.create = vi.fn(async () => undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ContextPanel store picker", () => {
  it("labels the picker 'Choose a store' on an unsupported site", () => {
    mount(infoFor("unsupported"));
    expect(container.textContent).toContain("Choose a store");
    expect(container.textContent).not.toContain("Not on a supported store");
    expect(picker()).not.toBeNull();
  });

  it("offers the picker on a store's non-coupon page", () => {
    mount(infoFor("store"));
    expect(container.textContent).toContain("Go to Safeway coupons");
    expect(picker()).not.toBeNull();
  });

  it("offers the picker on the coupons page so the next store can be chosen", () => {
    mount(infoFor("coupons"));
    expect(container.textContent).toContain("Clip All");
    expect(picker()).not.toBeNull();
  });

  it("greys out the current store in the picker", () => {
    mount(infoFor("coupons"));
    const option = picker()!.querySelector('option[value="Safeway"]') as HTMLOptionElement;
    expect(option.disabled).toBe(true);
    const other = picker()!.querySelector('option[value="CVS"]') as HTMLOptionElement;
    expect(other.disabled).toBe(false);
  });

  it("opens the chosen store's coupon page in the current window", () => {
    mount(infoFor("coupons"));
    const cvs = getStoreByName("CVS")!;
    act(() => {
      const select = picker()!;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!;
      setter.call(select, "CVS");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => goButton()!.click());
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: getCouponPageUrl(cvs), windowId: 3 });
  });
});
