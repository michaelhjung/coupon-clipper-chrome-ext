if (localStorage.getItem("abJ4uCoupons"))
  localStorage.removeItem("abJ4uCoupons");

setTimeout(function () {
  try {
    const storeId =
      typeof window.getStoreId === "function" ? window.getStoreId() : null;
    const { clientId, clientSecret } =
      window.SWY?.CONFIGSERVICE?.datapowerConfig || {};
    const user = window.AB?.userInfo;
    const correlationId = user?.UUID || window.AB?.COMMON?.generateUUID?.();
    const userServiceRef = window.userInfoServiceRefAL;

    const MAX_ATTEMPTS = 10;
    let attempts = 0;

    const sendData = (safewayShopToken) => {
      const data = {
        source: "coupon-clipper",
        type: "tokens",
        payload: {
          storeId,
          clientId,
          clientSecret,
          correlationId,
          token: safewayShopToken,
        },
      };
      window.postMessage(data, "*");
    };

    const waitForToken = () => {
      const token =
        user?.SWY_SHOP_TOKEN ||
        userServiceRef?.service?._userSession?.SWY_SHOP_TOKEN;

      if (token) {
        sendData(token);
      } else if (attempts++ < MAX_ATTEMPTS) {
        setTimeout(waitForToken, 100);
      } else {
        // Fallback: try to manually init session
        user?.service
          ?.initUserSession?.()
          .then((session) => {
            if (session?.SWY_SHOP_TOKEN) {
              user.service._userSession = session;
              sendData(session.SWY_SHOP_TOKEN);
            } else {
              console.warn(
                "[Coupon Clipper] Token not found even after fallback."
              );
            }
          })
          .catch((err) => {
            console.error(
              "[Coupon Clipper] Error calling initUserSession:",
              err
            );
          });
      }
    };

    waitForToken();
  } catch (err) {
    console.error("[Coupon Clipper] Error extracting variables:", err);
  }
}, 500);

if (window.location.hostname.includes("raleys.com")) {
  window.couponClipperLoadRaleysAll = async function () {
    console.log("[Coupon Clipper] Loading all Raley's coupons...");

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    let totalClicked = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => el.innerText.trim().toLowerCase() === "load more"
      );
      if (!button) break;

      console.log("🔘 Clicking 'Load More'...");
      button.click();
      totalClicked++;
      await delay(300);
    }

    console.log(`[Coupon Clipper] Done loading all Raley's coupons.`);

    window.postMessage(
      { type: "COUPON_CLIPPER_RALEYS_DONE", totalClicked },
      "*"
    );

    return totalClicked;
  };

  const trigger = document.createElement("div");
  trigger.id = "coupon-clipper-raleys-trigger";
  trigger.style.display = "none";
  document.body.appendChild(trigger);

  trigger.addEventListener("loadRaleysCoupons", () => {
    window.couponClipperLoadRaleysAll();
  });
}
