import { isRunning, requestStop, runClip, runCount, runLoadAll } from "./engine";
import { createAdapter } from "../adapters/index";
import { getStoreFromUrl, isCouponPath } from "../shared/constants";
import { log } from "../shared/log";
import { sendToWorker } from "../shared/messages";
import { getSettings } from "../shared/storage";

import type { WorkerToContent } from "../shared/types";

const AUTO_CLIP_POLL_MS = 1000;

const main = () => {
  const store = getStoreFromUrl(location.href);
  if (!store) return;
  const adapter = createAdapter(store);
  log.info(`content script ready on ${store.name} (${store.strategy}) at ${location.pathname}`);
  adapter.init?.();

  chrome.runtime.onMessage.addListener((msg: WorkerToContent, _sender, sendResponse) => {
    switch (msg.type) {
      case "CLIP_ALL":
        void getSettings().then((settings) => runClip(adapter, msg.trigger, settings));
        break;
      case "COUNT":
        void runCount(adapter);
        break;
      case "LOAD_ALL":
        void runLoadAll(adapter);
        break;
      case "STOP":
        requestStop();
        break;
    }
    sendResponse({ ok: true });
    return false;
  });

  // Auto-clip: ask the worker whenever we land on a coupon URL we have not
  // asked about yet (covers full loads and SPA navigation).
  let askedFor = "";
  const maybeAutoClip = async () => {
    if (location.href === askedFor) return;
    askedFor = location.href;
    if (!isCouponPath(store, location.pathname) || isRunning()) return;
    const reply = await sendToWorker<{ ok: boolean }>({
      type: "SHOULD_AUTO_CLIP",
      store: store.name,
    });
    if (!reply?.ok) {
      log.info(`auto-clip skipped on ${store.name} (disabled, on cooldown, or a run is active)`);
      return;
    }
    log.info(`auto-clip starting on ${store.name}`);
    await runClip(adapter, "auto", await getSettings());
  };
  void maybeAutoClip();
  setInterval(() => void maybeAutoClip(), AUTO_CLIP_POLL_MS);
};

main();
