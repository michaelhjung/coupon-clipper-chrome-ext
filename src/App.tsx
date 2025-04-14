import { useState, useEffect } from "react";

import "./App.css";

import couponClipperLogo from "/imgs/logo.jpg";

import { STORES } from "./constants";
import { clipAllHandler } from "./coupons/clip";
import { countAllHandler } from "./coupons/count";
import { loadAllHandler } from "./coupons/load";

type MessageType = {
  type: "CLIP_COUPONS_DONE" | "COUNT_COUPONS_DONE";
  count: number;
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
          {STORES.map((store) => (
            <option key={store.storeName} value={store.storeName}>
              {store.storeName}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const store = STORES.find(
              (store) => store.storeName === selectedStore
            );

            if (store) {
              window.open(store.url, "_blank");
              return;
            }

            alert("Please select a store.");
          }}
        >
          Go
        </button>
      </div>

      <div className="flex">
        <div className="card">
          <button
            onClick={() => loadAllHandler(setLoading)}
            disabled={loading || clipping}
          >
            {loading ? "Loading..." : "Load All"}
          </button>
        </div>
        <div className="card">
          <button
            onClick={() => countAllHandler(setCounting)}
            disabled={counting || clipping}
          >
            {counting ? "Counting..." : "Count Available"}
          </button>
        </div>
        <div className="card">
          <button
            onClick={() => clipAllHandler(setClipping)}
            disabled={clipping}
          >
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
                  refresh the page. Wait until
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
