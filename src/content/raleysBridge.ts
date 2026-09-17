// Counterpart of public/raleys-page-script.js: that script runs in the page's
// MAIN world and posts the outcome of every clip request; this side waits
// for the one a given click triggers.

const READY_ATTR = "ccRaleysBridge";
const SOURCE = "coupon-clipper";

export interface ClipResponseTimeouts {
  requestTimeoutMs: number; // the click must start a request within this
  responseTimeoutMs: number; // ...and the server must answer within this
}

export interface ClipResponse {
  status: number;
  body: string; // response text for a rejection, empty on success
}

export interface RaleysBridge {
  isReady(): boolean;
  // Resolves with the outcome of the first clip request that starts after
  // the call, or null when nothing starts or the response never arrives.
  nextClipResponse(timeouts: ClipResponseTimeouts): Promise<ClipResponse | null>;
}

export const isRaleysBridgeReady = () =>
  document.documentElement.dataset[READY_ATTR] === "1";

export const nextClipResponse = (t: ClipResponseTimeouts): Promise<ClipResponse | null> =>
  new Promise((resolve) => {
    let seq: number | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const done = (status: ClipResponse | null) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(status);
    };
    const onMessage = (event: MessageEvent) => {
      const d = event.data;
      if (event.source !== window || d?.source !== SOURCE) return;
      if (d.type === "raleys-clip-request" && seq === null) {
        seq = Number(d.seq);
        clearTimeout(timer);
        timer = setTimeout(() => done(null), t.responseTimeoutMs);
      } else if (d.type === "raleys-clip-response" && seq !== null && Number(d.seq) === seq) {
        done({ status: Number(d.status), body: typeof d.body === "string" ? d.body : "" });
      }
    };
    timer = setTimeout(() => done(null), t.requestTimeoutMs);
    window.addEventListener("message", onMessage);
  });

export const raleysBridge: RaleysBridge = {
  isReady: isRaleysBridgeReady,
  nextClipResponse,
};
