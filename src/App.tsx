import { useState, useEffect } from "react";

import "./App.css";

import couponClipperLogo from "/imgs/logo.jpg";

const executeScriptInActiveTab = async (func: () => void) => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab?.url || !isAllowedDomain(tab.url)) {
      alert(
        "Sorry, this coupon clipper is currently limited for use at safeway.com and albertsons.com"
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

// TODO: figure out why helper functions don't get executed inside of clipAllCoupons and countAvailableCoupons
// const getCouponButtons = () => {
//   const couponButtons = Array.from(
//     document.querySelectorAll("loyalty-card-action-buttons button")
//   ) as HTMLButtonElement[];

//   const couponButtonInnerTexts = ["clip coupon", "activate"];

//   return couponButtons.filter((button) =>
//     couponButtonInnerTexts.includes(button.innerText.trim().toLowerCase())
//   );
// };

type MessageType = {
  type: "CLIP_COUPONS_DONE" | "COUNT_COUPONS_DONE";
  count: number;
};

const stores = [
  {
    storeName: "Safeway",
    url: "https://www.safeway.com/foru/coupons-deals.html",
  },
  {
    storeName: "Albertsons",
    url: "https://www.albertsons.com/foru/coupons-deals.html",
  },
];

const isAllowedDomain = (url: string) => {
  const allowedDomains = ["albertsons.com", "safeway.com"];
  return allowedDomains.some((domain) => url.toLowerCase().includes(domain));
};

function App() {
  const [selectedStore, setSelectedStore] = useState("");
  const [loading, setLoading] = useState(false);
  const [clipping, setClipping] = useState(false);
  const [counting, setCounting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const handleMessage = (message: MessageType) => {
      if (message.type === "CLIP_COUPONS_DONE") {
        const alertMessage =
          message.count === 0
            ? `Looks like you've already clipped all the coupons!`
            : `Clipped ${message.count} ${
                message.count === 1 ? "coupon" : "coupons"
              }!`;
        alert(alertMessage + " Nice, you're one step closer to saving $$$!");
      }

      if (message.type === "COUNT_COUPONS_DONE") {
        alert(
          `There ${message.count === 1 ? "is" : "are"} ${message.count} ${
            message.count === 1 ? "coupon" : "coupons"
          } available to clip!`
        );
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleGoClick = () => {
    const store = stores.find((store) => store.storeName === selectedStore);

    if (store) {
      window.open(store.url, "_blank");
      return;
    }

    alert("Please select a store.");
  };

  const loadAllHandler = async () => {
    setLoading(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    setLoading(false);

    if (couponsLoaded) alert("All coupons loaded!");
  };

  const clickLoadMoreButtons = () => {
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

      const initialButton = Array.from(
        document.querySelectorAll("button")
      ).find(
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

  const clipAllHandler = async () => {
    setClipping(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    if (!couponsLoaded) return setClipping(false);

    await executeScriptInActiveTab(clipAllCoupons);
    setClipping(false);
  };

  const clipAllCoupons = async () => {
    const couponButtons = Array.from(
      document.querySelectorAll("loyalty-card-action-buttons button")
    ) as HTMLButtonElement[];
    const couponButtonInnerTexts = ["clip coupon", "activate"];
    const filteredCouponButtons =
      couponButtons.filter((button) =>
        couponButtonInnerTexts.includes(button.innerText.trim().toLowerCase())
      ) || [];

    let clipCount = 0;
    filteredCouponButtons.forEach((button) => {
      button.click();
      clipCount++;
    });

    chrome.runtime.sendMessage({
      type: "CLIP_COUPONS_DONE",
      count: clipCount,
    });
  };

  const countAllHandler = async () => {
    setCounting(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    if (!couponsLoaded) return setCounting(false);

    await executeScriptInActiveTab(countAvailableCoupons);
    setCounting(false);
  };

  const countAvailableCoupons = async () => {
    const couponButtons = Array.from(
      document.querySelectorAll("loyalty-card-action-buttons button")
    ) as HTMLButtonElement[];
    const couponButtonInnerTexts = ["clip coupon", "activate"];
    const filteredCouponButtons =
      couponButtons.filter((button) =>
        couponButtonInnerTexts.includes(button.innerText.trim().toLowerCase())
      ) || [];

    chrome.runtime.sendMessage({
      type: "COUNT_COUPONS_DONE",
      count: filteredCouponButtons.length,
    });
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div>
        <img
          src={couponClipperLogo}
          className="logo"
          alt="Coupon Clipper logo"
        />
      </div>

      <h1 className="text-3xl pt-2 pb-1">Coupon Clipper</h1>

      <small>
        by{" "}
        <a
          href="https://michaelhjung.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Michael Jung
        </a>
      </small>

      <div className="mt-6">
        <label htmlFor="storeSelect">Go To:</label>
        <select
          id="storeSelect"
          className="m-2 p-2"
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
        >
          <option value="">Select a store</option>
          {stores.map((store) => (
            <option key={store.storeName} value={store.storeName}>
              {store.storeName}
            </option>
          ))}
        </select>
        <button onClick={handleGoClick}>Go</button>
      </div>

      <div className="flex">
        <div className="card">
          <button onClick={loadAllHandler} disabled={loading || clipping}>
            {loading ? "Loading..." : "Load All"}
          </button>
        </div>
        <div className="card">
          <button onClick={countAllHandler} disabled={counting || clipping}>
            {counting ? "Counting..." : "Count Available"}
          </button>
        </div>
        <div className="card">
          <button onClick={clipAllHandler} disabled={clipping}>
            {clipping ? "Clipping..." : "Clip All"}
          </button>
        </div>
      </div>

      <div>
        <button onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions ? "Hide Instructions" : "Show Instructions"}
        </button>
        {showInstructions && (
          <ol className="list-decimal mt-2 text-left">
            <li>Navigate to the Albertsons or Safeway coupon page.</li>
            <li>
              <div>
                (Optional) Click "Load All" to load all coupons on the page.
              </div>
              <div>
                <small>
                  <strong>*Note</strong>: clicking "Clip All" will automatically
                  load all coupons for you before clipping them.
                </small>
              </div>
            </li>
            <li>
              <div>Click "Clip All" to clip all loaded coupons.</div>
              <div>
                <small>
                  <strong>*IMPORTANT</strong>: Do NOT close the tab too early or
                  refresh the page. Wait until "Clipping..." goes back to saying
                  "Clip All". Once you see all the coupons have been clipped,
                  you can double-check by using the "Count Available" button
                  (this should say 0).
                </small>
              </div>
            </li>
            <li>Sit back, and watch the magic happen.</li>
          </ol>
        )}
      </div>
    </div>
  );
}

export default App;
