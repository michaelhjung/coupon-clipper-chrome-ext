import { STORES } from "../constants";

export const executeScriptInActiveTab = async (func: () => void) => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab?.url || !isAllowedDomain(tab.url)) {
      `Sorry, this coupon clipper is currently limited for use at the following websites:\n\n${STORES.map(
        (store) => `• ${store.url}`
      ).join("\n")}`;
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
  const allowedDomains = ["albertsons.com", "safeway.com", "vons.com"];
  return allowedDomains.some((domain) => url.toLowerCase().includes(domain));
};
