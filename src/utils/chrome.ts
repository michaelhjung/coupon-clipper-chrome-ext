import { ALL_COUPON_PATHS, CouponPagePath, STORES } from "../constants";

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

    const { hostname: tabHostname, pathname } = new URL(tab.url!);

    const isValidCouponPagePath = Array.from(ALL_COUPON_PATHS).some(
      (validPath) => pathname.startsWith(validPath)
    );

    if (!isValidCouponPagePath) {
      const store = STORES.find((store) => tabHostname.includes(store.url));
      const expectedPath = store?.couponPath || CouponPagePath.FORU;

      alert(
        `Please navigate to the store’s coupon page:\n\n https://${tabHostname}${expectedPath}`
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
