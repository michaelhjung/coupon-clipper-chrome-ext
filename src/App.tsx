import { useState, useEffect } from "react";

import "./App.css";

import couponClipperLogo from "/imgs/logo_v2.png";

import { CHROME_EXT_URL, STORES, VERSION } from "./constants";
import { clipAllHandler } from "./coupons/clip";
import { countAllHandler } from "./coupons/count";
import { loadAllHandler } from "./coupons/load";
import {
  COUPON_CLIP_TALLY_KEY,
  CouponClipTally,
  getCouponClipTally,
} from "./coupons/tally";

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
  const [couponClipTally, setCouponClipTally] = useState<CouponClipTally>({});

  useEffect(() => {
    // load any previously selected store
    const chromeLocalStorage = chrome?.storage?.local;
    if (chromeLocalStorage) {
      chromeLocalStorage.get(["selectedStore"], (result) => {
        if (result.selectedStore) setSelectedStore(result.selectedStore);
      });
      getCouponClipTally().then(setCouponClipTally);
    }

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

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;
      if (!changes[COUPON_CLIP_TALLY_KEY]) return;

      setCouponClipTally(changes[COUPON_CLIP_TALLY_KEY].newValue || {});
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const couponClipTallyEntries = STORES.map((store) => ({
    storeName: store.name,
    count: couponClipTally[store.name] || 0,
  })).filter(({ count }) => count > 0);

  const totalCouponsClipped = couponClipTallyEntries.reduce(
    (total, { count }) => total + count,
    0
  );

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
        <strong>Version:</strong>{" "}
        <a href={CHROME_EXT_URL} target="_blank" rel="noopener noreferrer">
          {VERSION}
        </a>
        <br />
        by{" "}
        <a href="https://michaelhjung.com" target="_blank" rel="noopener">
          Michael Jung
        </a>
      </small>

      <div className="mt-6">
        <label htmlFor="storeSelect">Go To:</label>
        <select
          id="storeSelect"
          className="m-2 p-2"
          value={selectedStore}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedStore(value);
            chrome.storage.local.set({ selectedStore: value });
          }}
        >
          <option value="">Select a store</option>
          {STORES.map((store) => (
            <option key={store.name} value={store.name}>
              {store.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const store = STORES.find((store) => store.name === selectedStore);
            if (!store) return alert("Please select a store.");

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              chrome.tabs.create({
                url: `https://www.${store.url}${store.couponPath}`,
                windowId: tabs[0].windowId, // Ensure it opens in the same window
              });
            });
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

      <section className="my-5 w-full max-w-sm rounded-lg border border-slate-500/20 bg-slate-500/5 p-4 text-left shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              Coupons Clipped
            </h2>
            <p className="mt-1 text-xs opacity-70">Lifetime total by store</p>
          </div>
          <strong className="rounded-md bg-emerald-500/15 px-3 py-1 text-lg leading-none text-emerald-500">
            {totalCouponsClipped}
          </strong>
        </div>

        {couponClipTallyEntries.length ? (
          <ul className="mt-4 divide-y divide-slate-500/20">
            {couponClipTallyEntries.map(({ storeName, count }) => (
              <li
                key={storeName}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span>{storeName}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-slate-500/25 px-3 py-4 text-center text-sm opacity-75">
            No coupons clipped yet.
          </p>
        )}
      </section>

      <div className="mt-1">
        <button onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions ? "Hide Instructions" : "Show Instructions"}
        </button>
        {showInstructions && (
          <ol className="list-decimal mt-2 text-left">
            <li>
              Navigate to the coupon page for the store you want. Make sure
              you're logged in.
            </li>
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
                  refresh the page. Wait until you see the alert message that
                  says: "X coupons clipped successfully!"
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
