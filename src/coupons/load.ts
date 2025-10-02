import { executeScriptInActiveTab } from "../utils/chrome";

export const loadAllHandler = async (
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setLoading(true);

  const [tab] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs);
    });
  });

  if (!tab?.url) {
    setLoading(false);
    return alert("Cannot determine the active tab URL");
  }
  const isRaleys = tab.url.includes("raleys.com");

  // const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
  const couponsLoaded = await executeScriptInActiveTab(
    isRaleys ? clickRaleysLoadMore : clickLoadMoreButtons
  );
  setLoading(false);

  if (couponsLoaded) alert("All coupons loaded!");
};

export const clickLoadMoreButtons = () => {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
      ) as HTMLButtonElement | undefined;

      if (button) {
        button.click();

        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });

        console.info("Clicked 'Load more' button.");
      } else {
        observer.disconnect();
        console.info("No more 'Load more' buttons found.");
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const initialButton = Array.from(document.querySelectorAll("button")).find(
      (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
    ) as HTMLButtonElement | undefined;

    if (initialButton) {
      initialButton.click();
      console.info("Clicked initial 'Load more' button.");
    } else {
      observer.disconnect();
      console.info("No 'Load more' buttons found.");
      resolve();
    }
  });
};

export const clickRaleysLoadMore = () => {
  return new Promise<number>((resolve) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type === "COUPON_CLIPPER_RALEYS_DONE") {
        window.removeEventListener("message", handleMessage);
        resolve(event.data.totalClicked);
      }
    };

    window.addEventListener("message", handleMessage);

    const trigger = document.getElementById("coupon-clipper-raleys-trigger");
    if (!trigger) return resolve(0);

    trigger.dispatchEvent(new CustomEvent("loadRaleysCoupons"));
  });
};
