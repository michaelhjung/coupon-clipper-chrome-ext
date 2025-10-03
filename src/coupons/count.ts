import { clickLoadMoreButtons, clickRaleysLoadMore } from "./load";
import { executeScriptInActiveTab } from "../utils/chrome";

export const countAllHandler = async (
  setCounting: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setCounting(true);

  // Determine if the current tab is Raley's
  const [tab] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs);
    });
  });

  if (!tab?.url) {
    setCounting(false);
    return alert("Cannot determine the active tab URL");
  }

  const isRaleys = tab.url.includes("raleys.com");

  // Load all coupons first
  await executeScriptInActiveTab(
    isRaleys ? clickRaleysLoadMore : clickLoadMoreButtons
  );

  // Count coupons
  await executeScriptInActiveTab(countAvailableCoupons);

  setCounting(false);
};

const countAvailableCoupons = async () => {
  let filteredCouponButtons: HTMLButtonElement[] = [];

  if (window.location.hostname.includes("raleys.com")) {
    filteredCouponButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).filter((btn) => {
      const p = btn.querySelector("p");
      return p?.innerText.trim().toLowerCase() === "clip";
    });
  } else {
    filteredCouponButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "loyalty-card-action-buttons button"
      )
    ).filter((button) => {
      const text = button.innerText.trim().toLowerCase();
      return ["clip coupon", "activate"].includes(text);
    });
  }

  chrome.runtime.sendMessage({
    type: "COUNT_COUPONS_DONE",
    count: filteredCouponButtons.length,
  });
};
