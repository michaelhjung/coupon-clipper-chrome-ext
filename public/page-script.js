if (localStorage.getItem("abJ4uCoupons"))
  localStorage.removeItem("abJ4uCoupons");

setTimeout(function () {
  try {
    const storeId =
      typeof window.getStoreId === "function" ? window.getStoreId() : null;
    const { clientId, clientSecret } =
      window.SWY?.CONFIGSERVICE?.datapowerConfig || {};
    const correlationId = window.AB?.COMMON?.generateUUID?.();
    let user = window.userInfoServiceRefAL;

    // Wait for the SWY_SHOP_TOKEN to be available in the user object
    const waitForToken = () => {
      if (user?.service?._userSession?.SWY_SHOP_TOKEN) {
        // Token is available, send it
        const data = {
          source: "coupon-clipper",
          type: "tokens",
          payload: {
            storeId,
            clientId,
            clientSecret,
            correlationId,
            user: JSON.parse(JSON.stringify(user)),
          },
        };
        window.postMessage(data, "*");
      } else {
        // Token not available yet, check again in 100ms
        setTimeout(waitForToken, 100);
      }
    };

    waitForToken();
  } catch (err) {
    console.error("[Coupon Clipper] Error extracting variables:", err);
  }
}, 1000);
