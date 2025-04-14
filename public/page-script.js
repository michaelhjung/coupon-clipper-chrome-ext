(function () {
  try {
    const coupons = window.couponGridCompRef?.component?.coupons || [];
    const storeId =
      typeof window.getStoreId === "function" ? window.getStoreId() : null;
    const ssoToken =
      window.couponGridCompRef?.component?._userInfoService?.getSWY_SHOP_TOKEN?.();
    const { clientId, clientSecret } =
      window.SWY?.CONFIGSERVICE?.datapowerConfig || {};
    const correlationId = window.AB?.COMMON?.generateUUID?.();

    const data = {
      source: "coupon-clipper",
      type: "tokens",
      payload: {
        coupons,
        storeId,
        ssoToken,
        clientId,
        clientSecret,
        correlationId,
      },
    };

    window.postMessage(data, "*");
  } catch (err) {
    console.error("[Coupon Clipper] Error extracting variables:", err);
  }
})();
