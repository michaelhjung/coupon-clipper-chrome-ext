import { clickLoadMoreButtons } from "./load";
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

  const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
  if (!couponsLoaded) return setClipping(false);

  await executeScriptInActiveTab(clipCouponsUsingAPI);
  setClipping(false);
};

const clipCouponsUsingAPI = async () => {
  const dataElement = document.getElementById("coupon-clipper-data");
  if (!dataElement) throw new Error("There was a problem clipping the coupons");

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
    loader.style.zIndex = "9999";
    loader.style.textAlign = "center";
    loader.style.boxShadow = "0 12px 28px rgba(0,0,0,0.35)";
    loader.style.pointerEvents = "auto";
    document.body.style.pointerEvents = "none";
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
    `;
    return loader;
  };
  const removeLoader = () => {
    document.body.removeChild(loader);
    document.body.style.pointerEvents = "";
  };

  const style = buildStyle();
  const loader = buildLoader();

  document.head.appendChild(style);
  document.body.appendChild(loader);

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

  const clipCoupons = async (
    url: string,
    headers: HeadersInit,
    couponData: CouponData[],
    clippedCountElement: HTMLElement | null,
    progressBar: HTMLElement | null
  ) => {
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
          console.warn(`❌ Failed to clip: ${coupon.name}`);
        }
      } catch (err) {
        console.error(`💥 Error clipping coupon: ${coupon.name}`, err);
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
      console.info("Cleared localStorage key: abJ4uCoupons");
    } else {
      console.info("No localStorage key 'abJ4uCoupons' found to clear.");
    }
  }, 1000);
};
