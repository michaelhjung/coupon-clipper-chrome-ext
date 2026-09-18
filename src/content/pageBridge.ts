import { waitFor } from "./loadMore";
import { log } from "../shared/log";
import { asString } from "../shared/text";

export interface AlbertsonsSession {
  storeId: string;
  clientId: string;
  clientSecret: string;
  correlationId: string;
  token: string | null;
}

let session: AlbertsonsSession | null = null;

// Injects page-script.js into the MAIN world and keeps whatever it posts back
// in memory. Nothing is written to the DOM.
export const initPageBridge = () => {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.data?.source !== "coupon-clipper") return;
    const p = event.data.payload ?? {};
    session = {
      storeId: asString(p.storeId),
      clientId: asString(p.clientId),
      clientSecret: asString(p.clientSecret),
      correlationId: asString(p.correlationId),
      token: asString(p.token) || null,
    };
    log.info(
      `page bridge: session received (storeId=${session.storeId || "none"}, ` +
        `token=${session.token ? "yes" : "no"}, clientId=${session.clientId ? "yes" : "no"})`
    );
  });

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-script.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).append(script);
};

export const getSession = () => session;

export const waitForSession = async (timeoutMs: number): Promise<AlbertsonsSession | null> => {
  await waitFor(() => Boolean(session?.token), { timeoutMs, pollMs: 200 });
  return session;
};

export const setSessionForTests = (s: AlbertsonsSession | null) => {
  session = s;
};
