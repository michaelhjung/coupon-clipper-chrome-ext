if (window?.location?.hostname?.includes("raleys.com")) {
  window.couponClipperLoadRaleysAll = async function () {
    console.info("[ coupon clipper ] Loading all Raley's coupons...");

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    const MAX_ATTEMPTS = 20; // safeguard
    let attempts = 0;
    let totalClicked = 0;

    // eslint-disable-next-line no-constant-condition
    while (attempts++ < MAX_ATTEMPTS) {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => el.innerText.trim().toLowerCase() === "load more"
      );

      if (!button) break;

      console.info("[ coupon clipper ] 🔘 Clicking 'Load More'...");
      button.click();
      totalClicked++;
      await delay(500);
    }

    console.info(`[ coupon clipper ] Done loading all Raley's coupons.`);

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
} else {
  // Clear known localStorage key if present
  if (localStorage.getItem("abJ4uCoupons"))
    localStorage.removeItem("abJ4uCoupons");

  // Small delay so page scripts can begin initializing
  setTimeout(function () {
    try {
      const storeId =
        typeof window.getStoreId === "function" ? window.getStoreId() : null;
      const { clientId, clientSecret } =
        window.SWY?.CONFIGSERVICE?.datapowerConfig || {};
      const user = window.AB?.userInfo;
      const correlationId = user?.UUID || window.AB?.COMMON?.generateUUID?.();
      const userServiceRef = window.userInfoServiceRefAL;

      // Robust waiter that polls for token, but uses requestAnimationFrame for lower CPU usage;
      // falls back to calling initUserSession (and respects a timeout)
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

        // Poll using requestAnimationFrame but respect timeout and occasional setTimeout
        return await new Promise((resolve) => {
          let rafId = null;
          let intervalId = null;

          const cleanup = () => {
            if (rafId) cancelAnimationFrame(rafId);
            if (intervalId) clearInterval(intervalId);
          };

          const check = () => {
            const token = tryGetToken();
            if (token) {
              cleanup();
              return resolve(token);
            }
            if (Date.now() - start > timeoutMs) {
              cleanup();
              return resolve(null); // resolve null to let caller decide fallback
            }
            rafId = requestAnimationFrame(check);
          };

          // Also do an interval check at a slower cadence to catch things
          intervalId = setInterval(() => {
            const token = tryGetToken();
            if (token) {
              cleanup();
              return resolve(token);
            }
            if (Date.now() - start > timeoutMs) {
              cleanup();
              return resolve(null);
            }
          }, 200);

          // kick off RAF checks
          rafId = requestAnimationFrame(check);
        });
      };

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

      (async () => {
        try {
          const token = await waitForToken(5000); // 5s timeout
          if (token) {
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
                "[ coupon clipper ] Error calling initUserSession:",
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
      console.error("[ coupon clipper ] Error extracting variables:", err);
    }
  }, 500);
}
