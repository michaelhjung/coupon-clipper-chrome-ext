import { useState } from "react";

import "./App.css";

import couponClipperLogo from "/imgs/logo.jpg";

function App() {
  const [selectedStore, setSelectedStore] = useState("");
  const [loading, setLoading] = useState(false);
  const [clipping, setClipping] = useState(false);
  const [counting, setCounting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

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

  const handleGoClick = () => {
    const store = stores.find((store) => store.storeName === selectedStore);

    if (store) {
      window.open(store.url, "_blank");
      return;
    }

    alert("Please select a store.");
  };

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

  const isAllowedDomain = (url: string) => {
    const allowedDomains = ["albertsons.com", "safeway.com"];
    return allowedDomains.some((domain) => url.toLowerCase().includes(domain));
  };

  const loadAllHandler = async () => {
    setLoading(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    setLoading(false);

    if (couponsLoaded) alert("All coupons loaded!");
  };

  const clipAllHandler = async () => {
    setClipping(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    if (!couponsLoaded) return setClipping(false);

    await executeScriptInActiveTab(clipAllCoupons);
    setClipping(false);
  };

  const countAllHandler = async () => {
    setCounting(true);
    const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
    if (!couponsLoaded) return setCounting(false);

    await executeScriptInActiveTab(countAvailableCoupons);
    setCounting(false);
  };

  const clickLoadMoreButtons = () => {
    return new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
        ) as HTMLButtonElement | undefined;

        if (button) {
          button.click();
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

  const clipAllCoupons = () => {
    let clipCount = 0;

    return new Promise<void>((resolve) => {
      const clipCouponButtons = document.querySelectorAll(
        "loyalty-card-action-buttons button"
      );

      clipCouponButtons.forEach((element) => {
        const button = element as HTMLButtonElement;
        const targetInnerTexts = ["clip coupon", "activate"];
        if (targetInnerTexts.includes(button.innerText.trim().toLowerCase())) {
          button.click();
          clipCount++;
        }
      });

      resolve();
    }).then(() => {
      const alertMessage =
        clipCount === 0
          ? `Looks like you've already clipped all the coupons!`
          : `Clipped ${clipCount} ${clipCount === 1 ? "coupon" : "coupons"}!`;
      alert(alertMessage + " Nice, you're one step closer to saving $$$!");
    });
  };

  const countAvailableCoupons = () => {
    let couponCount = 0;

    return new Promise<void>((resolve) => {
      const couponButtons = document.querySelectorAll(
        "loyalty-card-action-buttons button"
      );

      couponButtons.forEach((element) => {
        const button = element as HTMLButtonElement;
        const targetInnerTexts = ["clip coupon", "activate"];
        if (targetInnerTexts.includes(button.innerText.trim().toLowerCase())) {
          couponCount++;
        }
      });

      resolve();
    }).then(() => {
      alert(
        `There are ${couponCount} ${
          couponCount === 1 ? "coupon" : "coupons"
        } available to clip!`
      );
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
          <button onClick={loadAllHandler} disabled={loading}>
            {loading ? "Loading..." : "Load All"}
          </button>
        </div>
        <div className="card">
          <button onClick={countAllHandler} disabled={counting}>
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
                  <strong>*IMPORTANT</strong>: try NOT to close the tab too
                  early or refresh the page - double-check to check if all
                  coupons have been clipped by using the "Count Available"
                  button (this should say 0).
                </small>
              </div>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

export default App;
