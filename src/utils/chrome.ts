import { COUPON_PAGE_PATH, STORES } from "../constants";

export const executeScriptInActiveTab = async (func: () => void) => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab?.url || !isAllowedDomain(tab.url)) {
      alert(
        `Sorry, this coupon clipper is currently limited for use at the following websites:\n\n${STORES.map(
          (store) => `• ${store.url}`
        ).join("\n")}`
      );
      return false;
    }

    if (!tab.url.includes(COUPON_PAGE_PATH)) {
      const tabHostname = new URL(tab.url).hostname;
      alert(
        `Please make sure you're on the coupon page: https://${tabHostname}${COUPON_PAGE_PATH}`
      );
      return false;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func,
    });

    return true;
  } catch (error) {
    console.error("Failed to execute script in active tab:", error);
    return false;
  }
};

const isAllowedDomain = (url: string) => {
  const allowedDomains = STORES.map((store) => store.url);
  return allowedDomains.some((domain) => url.toLowerCase().includes(domain));
};
