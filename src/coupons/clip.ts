import { clickLoadMoreButtons, clickRaleysLoadMore } from "./load";
import {
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_SECRET,
  DEFAULT_CORRELATION_ID,
} from "../constants";
import { executeScriptInActiveTab } from "../utils/chrome";

/*****************************************************************************
IMPORTANT:
Much of the logic must be in-line rather than separated out into external helpers
due to needing to run in the execution context of the page rather than the extension.
*****************************************************************************/

export const clipAllHandler = async (
  setClipping: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setClipping(true);

  const [tab] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs);
    });
  });

  if (!tab?.url) {
    setClipping(false);
    return alert("Cannot determine the active tab URL");
  }

  const isRaleys = tab.url.includes("raleys.com");

  const couponsLoaded = await executeScriptInActiveTab(
    isRaleys ? clickRaleysLoadMore : clickLoadMoreButtons
  );
  if (!couponsLoaded) return setClipping(false);

  await executeScriptInActiveTab(
    isRaleys ? clipRaleysCoupons : clipCouponsUsingAPI
  );

  setClipping(false);
};

const clipRaleysCoupons = async () => {
  let stopClipping = false;

  // Build loader (reuse same loader as API)
  const buildStyle = () => {
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
    return style;
  };

  const buildLoader = () => {
    const loader = document.createElement("div");
    loader.id = "clipping-loader";
    loader.setAttribute("role", "alert");
    loader.style.position = "fixed";
    loader.style.top = "50%";
    loader.style.left = "50%";
    loader.style.transform = "translate(-50%, -50%)";
    loader.style.padding = "24px 32px";
    loader.style.backgroundColor = "rgba(20, 20, 20, 0.75)";
    loader.style.color = "#fff";
    loader.style.fontSize = "18px";
    loader.style.fontWeight = "300";
    loader.style.fontFamily =
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
    loader.style.borderRadius = "12px";
    loader.style.zIndex = "9001";
    loader.style.textAlign = "center";
    loader.style.boxShadow = "0 12px 28px rgba(0,0,0,0.35)";
    loader.innerHTML = `
      <p style="margin-bottom: 8px; line-height: 1.5;">Clipping in progress...<br>Please do not refresh the page.</p>
      <p id="clipped-count" style="font-weight: 500; margin-bottom: 16px;" aria-live="polite">Coupons clipped: 0 / 0</p>
      <div id="ellipsis-container" style="display: flex; justify-content: center;">
        <div id="ellipsis-animation" style="display: inline-flex; justify-content: space-between; width: 50px;">
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
        </div>
      </div>
      <div style="background: rgba(255 255 255 / 0.2); border-radius: 8px; height: 16px; width: 320px; margin: 8px auto 12px;">
        <div id="progress-bar" style="background: #4caf50; height: 100%; width: 0%; border-radius: 8px; transition: width 0.3s ease;"></div>
      </div>
      <button id="stop-clipping-btn" style="
        margin-top: 8px;
        padding: 8px 16px;
        border: none;
        background-color: #ff4d4f;
        color: white;
        font-size: 14px;
        border-radius: 6px;
        cursor: pointer;
      ">
        Stop Clipping
      </button>
    `;
    return loader;
  };

  const style = buildStyle();
  const loader = buildLoader();
  document.head.appendChild(style);
  document.body.appendChild(loader);

  document
    .getElementById("stop-clipping-btn")
    ?.addEventListener("click", () => {
      stopClipping = true;
      const btn = document.getElementById("stop-clipping-btn");
      if (btn) btn.innerText = "Stopping...";
    });

  const clippedCountElement = document.getElementById("clipped-count");
  const progressBar = document.getElementById("progress-bar");

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button")
  ).filter(
    (btn) => btn.querySelector("p")?.innerText.trim().toLowerCase() === "clip"
  );

  const total = buttons.length;
  if (!total) {
    loader.remove();
    alert("No coupons found to clip on Raley's.");
    return;
  }

  let clipped = 0;
  for (const btn of buttons) {
    if (stopClipping) break;

    btn.click();
    clipped++;

    if (clippedCountElement) {
      clippedCountElement.innerText = `Coupons clipped: ${clipped} / ${total}`;
    }
    if (progressBar) {
      progressBar.style.width = `${(clipped / total) * 100}%`;
    }

    // small delay to avoid overwhelming the page
    await new Promise((res) => setTimeout(res, 100));
  }

  loader.remove();
  alert(`${clipped} coupons clipped successfully on Raley's!`);
};

const clipCouponsUsingAPI = async () => {
  const dataElement = document.getElementById("coupon-clipper-data");
  if (!dataElement) throw new Error("There was a problem clipping the coupons");
  let stopClipping = false;

  const buildStyle = () => {
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
    return style;
  };
  const buildLoader = () => {
    const loader = document.createElement("div");
    loader.id = "clipping-loader";
    loader.setAttribute("role", "alert");
    loader.style.position = "fixed";
    loader.style.top = "50%";
    loader.style.left = "50%";
    loader.style.transform = "translate(-50%, -50%)";
    loader.style.padding = "24px 32px";
    loader.style.backgroundColor = "rgba(20, 20, 20, 0.75)";
    loader.style.color = "#fff";
    loader.style.fontSize = "18px";
    loader.style.fontWeight = "300";
    loader.style.fontFamily =
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
    loader.style.borderRadius = "12px";
    loader.style.zIndex = "9001";
    loader.style.textAlign = "center";
    loader.style.boxShadow = "0 12px 28px rgba(0,0,0,0.35)";
    loader.innerHTML = `
      <p style="margin-bottom: 8px; line-height: 1.5;">Clipping in progress...<br>Please do not refresh the page.</p>
      <p id="clipped-count" style="font-weight: 500; margin-bottom: 16px;" aria-live="polite">Coupons clipped: 0 / 0</p>
      <div id="ellipsis-container" style="display: flex; justify-content: center;">
        <div id="ellipsis-animation" style="display: inline-flex; justify-content: space-between; width: 50px;">
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
          <span class="ellipsis-dot"></span>
        </div>
      </div>
      <div style="background: rgba(255 255 255 / 0.2); border-radius: 8px; height: 16px; width: 320px; margin: 8px auto 12px;">
        <div id="progress-bar" style="background: #4caf50; height: 100%; width: 0%; border-radius: 8px; transition: width 0.3s ease;"></div>
      </div>
      <button id="stop-clipping-btn" style="
        margin-top: 8px;
        padding: 8px 16px;
        border: none;
        background-color: #ff4d4f;
        color: white;
        font-size: 14px;
        border-radius: 6px;
        cursor: pointer;
      ">
        Stop Clipping
      </button>
    `;
    return loader;
  };
  const removeLoader = () => document.body.removeChild(loader);

  const style = buildStyle();
  const loader = buildLoader();

  document.head.appendChild(style);
  document.body.appendChild(loader);
  document
    .getElementById("stop-clipping-btn")
    ?.addEventListener("click", () => {
      stopClipping = true;
      const btn = document.getElementById("stop-clipping-btn");
      if (btn) btn.innerText = "Stopping...";
    });

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
        const href = hrefElement?.getAttribute("href") || "";

        // Try to match two-letter uppercase codes anywhere in the href
        const itemTypeMatch = href.match(/([A-Z]{2})(?:\.html)?/);
        const offerPgm = itemTypeMatch ? itemTypeMatch[1] : "SC";
        const fallbackOfferPgms = ["SC", "MF", "PD"];
        const nameElement = card.querySelector("h5.cpn-title");
        const name = nameElement?.textContent?.trim() || "No Name Found";

        if (!itemTypeMatch) {
          console.warn(
            `[ coupon clipper ] No offerPgm found in href "${href}", defaulting to SC/MF fallback`
          );
          fallbackOfferPgms.forEach((pgm) =>
            coupons.push({
              offerId,
              offerPgm: pgm,
              name,
            })
          );
          return;
        }

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
  const clippedCountElement = document.getElementById("clipped-count");
  const progressBar = document.getElementById("progress-bar");

  const handleNoCouponsFound = () => {
    if (clippedCountElement && progressBar) {
      clippedCountElement.innerHTML = `Coupons clipped: 0 / 0`;

      let progress = 0;
      const animateBar = () => {
        if (progress < 100) {
          progress += 2;
          progressBar.style.width = `${progress}%`;
          requestAnimationFrame(animateBar);
        } else {
          setTimeout(() => {
            removeLoader();
            alert("No coupons found to clip.");
          }, 300);
        }
      };

      animateBar();
    } else {
      removeLoader();
      alert("No coupons found to clip.");
    }
  };
  if (!couponData?.length) {
    console.error(
      "[ coupon clipper ] no coupons found, couponData:",
      couponData
    );
    handleNoCouponsFound();
    return;
  }

  const storeId = dataElement.getAttribute("data-store-id") || "";
  const clientId =
    dataElement.getAttribute("data-client-id") || DEFAULT_CLIENT_ID;
  const clientSecret =
    dataElement.getAttribute("data-client-secret") || DEFAULT_CLIENT_SECRET;
  const correlationId =
    dataElement.getAttribute("data-correlation-id") || DEFAULT_CORRELATION_ID;
  const accessToken = dataElement.getAttribute("data-access-token") || "";
  const getBaseDomain = () => {
    const hostname = window.location.hostname;
    return `https://${hostname}`;
  };
  const url = `${getBaseDomain()}/abs/pub/web/j4u/api/offers/clip?storeId=${storeId}`;
  const headers = {
    "Content-Type": "application/json",
    SWY_SSO_TOKEN: accessToken,
    "X-IBM-Client-Id": clientId,
    "X-IBM-Client-Secret": clientSecret,
    "X-SWY_API_KEY": "emjou",
    "X-SWY_BANNER": "safeway",
    "X-SWY_VERSION": "1.0",
    "X-swyConsumerDirectoryPro": accessToken,
    "x-swy-correlation-id": correlationId,
  };

  console.info("[ coupon clipper ] storeId:", storeId);
  console.info("[ coupon clipper ] header:", headers);

  const clipCoupons = async (
    url: string,
    headers: HeadersInit,
    couponData: CouponData[],
    clippedCountElement: HTMLElement | null,
    progressBar: HTMLElement | null
  ) => {
    let clipped = 0;

    for (const coupon of couponData) {
      if (stopClipping) {
        console.warn("[ coupon clipper ] Clipping stopped by user.");
        break;
      }

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
        console.info("[ coupon clipper ] clip result:", result);

        if (result?.items?.[0]?.status === 1) {
          clipped++;

          if (clippedCountElement) {
            clippedCountElement.innerHTML = `Coupons clipped: ${clipped} / ${couponData.length}`;
          }
          if (progressBar) {
            const percent = (clipped / couponData.length) * 100;
            progressBar.style.width = `${percent}%`;
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
          console.warn(`[ coupon clipper ] ❌ Failed to clip: ${coupon.name}`);
        }
      } catch (err) {
        console.error(
          `[ coupon clipper ] 💥 Error clipping coupon: ${coupon.name}`,
          err
        );
      }
    }

    return clipped;
  };

  const clipped = await clipCoupons(
    url,
    headers,
    couponData,
    clippedCountElement,
    progressBar
  );

  setTimeout(() => {
    removeLoader();

    alert(`${clipped} coupons clipped successfully!`);

    if (localStorage.getItem("abJ4uCoupons")) {
      localStorage.removeItem("abJ4uCoupons");
      console.info("[ coupon clipper ] Cleared localStorage key: abJ4uCoupons");
    } else {
      console.info(
        "[ coupon clipper ] No localStorage key 'abJ4uCoupons' found to clear."
      );
    }
  }, 1000);
};
