export const executeScriptInActiveTab = async (func: () => void) => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab?.url || !isAllowedDomain(tab.url)) {
      alert(
        "Sorry, this coupon clipper is currently limited for use at albertsons.com, safeway.com, or vons.com"
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
  const allowedDomains = ["albertsons.com", "safeway.com", "vons.com"];
  return allowedDomains.some((domain) => url.toLowerCase().includes(domain));
};
