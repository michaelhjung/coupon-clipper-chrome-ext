// Runs in the page's MAIN world on Albertsons-family sites only (the content
// script injects it). Reads the session token and API keys the site already
// exposes on window and posts them to the content script.
// The site caches its coupon gallery here; clearing it on load makes the page
// re-fetch so cards reflect clips made through the API.
if (localStorage.getItem("abJ4uCoupons"))
  localStorage.removeItem("abJ4uCoupons");

// Small delay so page scripts can begin initializing
setTimeout(function () {
  try {
    const user = window.AB?.userInfo;
    const userServiceRef = window.userInfoServiceRefAL;
    const { clientId, clientSecret } =
      window.SWY?.CONFIGSERVICE?.datapowerConfig || {};
    const correlationId = user?.UUID || window.AB?.COMMON?.generateUUID?.();

    const getStoreIdSafe = () => {
      const getters = [
        () => user?.j4u?.storeId,
        () => user?.branchId,
        () => userServiceRef?.service?.userInfo?.j4u?.storeId,
        () => userServiceRef?.service?.userInfo?.branchId,
        () =>
          typeof window.getStoreId === "function"
            ? window.getStoreId()
            : null,
      ];

      for (const get of getters) {
        try {
          const val = get();
          if (val) return String(val).trim();
        } catch (err) {
          console.warn(
            "[ coupon clipper ] Error checking storeId candidate:",
            err
          );
        }
      }

      console.error(
        "[ coupon clipper ] 💥 storeId was not found, using 908 as a fallback"
      );
      return "908";
    };

    const storeId = getStoreIdSafe();

    // Polls for the token; the caller falls back to initUserSession on timeout.
    const waitForToken = async (timeoutMs = 5000) => {
      const start = Date.now();

      const tryGetToken = () => {
        const freshUser = window.AB?.userInfo || user;
        const token =
          freshUser?.SWY_SHOP_TOKEN ||
          userServiceRef?.service?._userSession?.SWY_SHOP_TOKEN;
        return token;
      };

      // fast path
      const existing = tryGetToken();
      if (existing) return existing;

      // Poll until the site exposes the token or we give up.
      return await new Promise((resolve) => {
        const intervalId = setInterval(() => {
          const token = tryGetToken();
          if (token || Date.now() - start > timeoutMs) {
            clearInterval(intervalId);
            resolve(token || null); // null lets the caller decide the fallback
          }
        }, 200);
      });
    };

    const sendData = (safewayShopToken) => {
      const payload = {
        storeId,
        clientId,
        clientSecret,
        correlationId,
        token: safewayShopToken,
      };

      Object.entries(payload).forEach(([key, value]) => {
        if (!value)
          console.error(
            `[ coupon clipper ] 💥 ${key} was not found or is invalid (${value}), sending anyway`
          );
      });

      const data = {
        source: "coupon-clipper",
        type: "tokens",
        payload,
      };

      window.postMessage(data, "*");
    };

    (async () => {
      try {
        const token = await waitForToken(5000); // 5s timeout
        if (token) {
          console.info("[ coupon clipper ] page script: session token found");
          sendData(token);
          return;
        }

        // If token wasn't found, try to init a session as a fallback (still within a timeout)
        if (user?.service?.initUserSession) {
          try {
            const sessionPromise = user.service.initUserSession();
            // give the init a max of 5s
            const session = await Promise.race([
              sessionPromise,
              new Promise((res) => setTimeout(() => res(null), 5000)),
            ]);
            if (session?.SWY_SHOP_TOKEN) {
              // ensure the local structure mirrors what the page expects
              user.service._userSession = session;
              sendData(session.SWY_SHOP_TOKEN);
              return;
            } else {
              console.warn(
                "[ coupon clipper ] initUserSession did not return SWY_SHOP_TOKEN"
              );
            }
          } catch (err) {
            console.error(
              "[ coupon clipper ] 💥 Error calling initUserSession:",
              err
            );
          }
        }

        // Final attempt: if still no token, send what we have (no token) but mark it explicitly
        console.warn(
          "[ coupon clipper ] Token not found within timeout. Sending partial payload."
        );
        sendData(null);
      } catch (err) {
        console.error(
          "[ coupon clipper ] Error in token extraction flow:",
          err
        );
      }
    })();
  } catch (err) {
    console.error("[ coupon clipper ] 💥 Error extracting variables:", err);
  }
}, 500);
