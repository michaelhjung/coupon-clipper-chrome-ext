import { useState, useEffect } from "react";

import "./App.css";

import couponClipperLogo from "/imgs/logo.jpg";

import {
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_SECRET,
  DEFAULT_CORRELATION_ID,
} from "./constants";

const executeScriptInActiveTab = async (func: () => void) => {
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
  {
    storeName: "Vons",
    url: "https://www.vons.com/foru/coupons-deals.html",
  },
];

const isAllowedDomain = (url: string) => {
  const allowedDomains = ["albertsons.com", "safeway.com", "vons.com"];
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

    await executeScriptInActiveTab(clipCouponsUsingAPI);
    setClipping(false);
  };

  const clipCouponsUsingAPI = async () => {
    const dataElement = document.getElementById("coupon-clipper-data");
    if (!dataElement)
      throw new Error("There was a problem clipping the coupons");

    // Create a loader element
    const loader = document.createElement("div");
    loader.id = "clipping-loader";
    loader.style.position = "fixed";
    loader.style.top = "50%";
    loader.style.left = "50%";
    loader.style.transform = "translate(-50%, -50%)";
    loader.style.padding = "24px 32px";
    loader.style.backgroundColor = "rgba(20, 20, 20, 0.5)";
    loader.style.color = "#fff";
    loader.style.fontSize = "18px";
    loader.style.fontWeight = "300";
    loader.style.fontFamily =
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
    loader.style.borderRadius = "12px";
    loader.style.zIndex = "9999";
    loader.style.textAlign = "center";
    loader.style.boxShadow = "0 12px 28px rgba(0,0,0,0.35)";
    loader.innerHTML = `
      <p style="margin-bottom: 8px; line-height: 1.5;">Clipping in progress...<br>Please do not refresh the page.</p>
      <p id="clipped-count" style="font-weight: 500; margin-bottom: 16px;">Coupons clipped: 0</p>
      <div id="ellipsis-container" style="display: flex; justify-content: center;">
        <div id="ellipsis-animation" style="display: inline-flex; justify-content: space-between; width: 50px;">
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
        </div>
      </div>
    `;

    // Inject styles for the bouncing dots
    const style = document.createElement("style");
    style.textContent = `
      @keyframes bounce {
        0% { transform: translateY(0); }
        100% { transform: translateY(-12px); }
      }

      .ellipsis-dot {
        width: 6px;
        height: 6px;
        margin: 0 3px;
        border-radius: 50%;
        background-color: #ffffff;
        animation: bounce 0.45s infinite alternate ease-in-out;
        opacity: 0.85;
      }

      .ellipsis-dot:nth-child(1) { animation-delay: 0s; }
      .ellipsis-dot:nth-child(2) { animation-delay: 0.1s; }
      .ellipsis-dot:nth-child(3) { animation-delay: 0.2s; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(loader);

    const storeId = dataElement.getAttribute("data-store-id");
    const clientId = dataElement.getAttribute("data-client-id");
    const clientSecret = dataElement.getAttribute("data-client-secret");
    const correlationId = dataElement.getAttribute("data-correlation-id");
    const accessToken = dataElement.getAttribute("data-access-token");

    const url = `https://www.safeway.com/abs/pub/web/j4u/api/offers/clip?storeId=${storeId}`;
    const headers = {
      "Content-Type": "application/json",
      SWY_SSO_TOKEN: accessToken || "",
      "X-IBM-Client-Id": clientId || DEFAULT_CLIENT_ID,
      "X-IBM-Client-Secret": clientSecret || DEFAULT_CLIENT_SECRET,
      "X-SWY_API_KEY": "emjou",
      "X-SWY_BANNER": "safeway",
      "X-SWY_VERSION": "1.0",
      "X-swyConsumerDirectoryPro": accessToken || "",
      "x-swy-correlation-id": correlationId || DEFAULT_CORRELATION_ID,
    };

    type CouponData = {
      offerId: string;
      offerPgm: string;
      name: string;
    };

    const getCouponData = (): CouponData[] => {
      const allButtons = Array.from(
        document.querySelectorAll("button")
      ) as HTMLButtonElement[];

      const couponButtons = allButtons.filter((button) => {
        return (
          button.id.startsWith("couponAddBtn") &&
          (button.innerText.trim().toLowerCase() === "clip coupon" ||
            button.innerText.trim().toLowerCase() === "activate")
        );
      });

      const coupons: CouponData[] = [];

      couponButtons.forEach((button) => {
        const match = button.id.match(/^couponAddBtn(\d+)$/);
        if (match) {
          const offerId = match[1];
          const card = button.closest(".coupon-card__card-body");
          if (!card) return;

          const hrefElement = card.querySelector(
            "a.coupon-card-offer-details[href*='offer-details']"
          );
          const itemTypeMatch = hrefElement
            ?.getAttribute("href")
            ?.match(/\.([A-Z]{2})\.html/);
          const offerPgm = itemTypeMatch ? itemTypeMatch[1] : "UNKNOWN";

          const nameElement = card.querySelector("h5.cpn-title");
          const name = nameElement?.textContent?.trim() || "No Name Found";

          coupons.push({
            offerId,
            offerPgm,
            name,
          });
        }
      });

      return coupons;
    };

    const couponData = getCouponData();

    let clipped = 0;
    for (const coupon of couponData) {
      const body = {
        items: [
          {
            clipType: "C",
            itemId: coupon.offerId,
            itemType: coupon.offerPgm,
          },
          {
            clipType: "L",
            itemId: coupon.offerId,
            itemType: coupon.offerPgm,
          },
        ],
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const result = await response.json();

        if (result?.items?.[0]?.status === 1) {
          clipped++;

          const clippedCountElement = document.getElementById("clipped-count");
          if (clippedCountElement) {
            clippedCountElement.innerHTML = `Coupons clipped: ${clipped}`;
          }

          const button = document.getElementById(
            `couponAddBtn${coupon.offerId}`
          );
          if (button) {
            const loyaltyCardActionButtons = button.closest(
              "loyalty-card-action-buttons"
            );
            if (loyaltyCardActionButtons) {
              loyaltyCardActionButtons.innerHTML = `
                <div>
                  <div class="clipped" aria-describedby="coupon-price-${coupon.offerId} coupon-title-${coupon.offerId} coupon-description-${coupon.offerId}">
                    <span class="clipped__checkmark svg-checkmark"></span>
                    <span class="clipped__label">
                      <span class="sr-only">Coupon has already been </span>Clipped
                    </span>
                  </div>
                </div>
              `;
            }
          }
        } else {
          console.warn(`Failed to clip: ${coupon.name}`);
        }
      } catch (err) {
        console.error(`Error clipping coupon: ${coupon.name}`, err);
      }
    }

    setTimeout(() => {
      document.body.removeChild(loader);
      alert(`${clipped} coupons clipped successfully!`);

      if (localStorage.getItem("abJ4uCoupons")) {
        localStorage.removeItem("abJ4uCoupons");
        console.info("Cleared localStorage key: abJ4uCoupons");
      } else {
        console.info("No localStorage key 'abJ4uCoupons' found to clear.");
      }
    }, 1000);
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
            <li>Navigate to the Albertsons, Safeway, or Vons coupon page.</li>
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
