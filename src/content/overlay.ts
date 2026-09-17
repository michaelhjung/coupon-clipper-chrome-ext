import { getSignInUrl } from "../shared/constants";
import { tallyParts } from "../shared/format";

import type { RunSummary, StoreConfig } from "../shared/types";

export interface OverlayHandle {
  setPhase(text: string): void;
  setProgress(p: { clipped: number; expired: number; failed: number; total: number }): void;
  showSummary(summary: RunSummary): void;
  showError(message: string): void;
  remove(): void;
}

const STYLE_ID = "cc-style";
const css = `
#cc-overlay{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:24px 32px;background:rgba(20,20,20,.88);color:#fff;font:300 16px/1.5 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-radius:12px;z-index:2147483000;text-align:center;box-shadow:0 12px 28px rgba(0,0,0,.35);min-width:340px}
#cc-overlay p{margin:0 0 8px}
#cc-overlay .cc-note{font-size:12px;opacity:.75;margin-top:10px}
#cc-bar{background:rgba(255,255,255,.2);border-radius:8px;height:12px;width:100%;margin:12px 0}
#cc-bar>div{background:#4caf50;height:100%;width:0;border-radius:8px;transition:width .3s}
#cc-stop,#cc-close{margin-top:8px;padding:8px 16px;border:0;background:#ff4d4f;color:#fff;font-size:14px;border-radius:6px;cursor:pointer}
#cc-close{background:#555}
#cc-signin{position:fixed;right:16px;bottom:16px;background:#1a1a1a;color:#fff;padding:14px 16px;border-radius:10px;z-index:2147483000;font:14px/1.4 Inter,-apple-system,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center}
#cc-signin a{color:#8fd3ff;font-weight:600}
#cc-signin button{background:transparent;border:0;color:#aaa;cursor:pointer;font-size:16px}
#cc-busy{position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:12px 20px;background:rgba(20,20,20,.88);color:#fff;font:400 14px/1.4 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-radius:10px;z-index:2147483000;box-shadow:0 8px 20px rgba(0,0,0,.35);display:flex;align-items:center;gap:12px}
.cc-dots{display:inline-flex;gap:4px}
.cc-dots span{width:6px;height:6px;border-radius:50%;background:#fff;opacity:.85;animation:cc-bounce .45s infinite alternate ease-in-out}
.cc-dots span:nth-child(2){animation-delay:.1s}
.cc-dots span:nth-child(3){animation-delay:.2s}
@keyframes cc-bounce{from{transform:translateY(0)}to{transform:translateY(-6px)}}
`;

const DOTS = '<span class="cc-dots"><span></span><span></span><span></span></span>';

const ensureStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
};

const AUTO_CLIP_NOTE =
  "Auto-clip is on — you can turn it off in Coupon Clipper's settings.";

const summaryText = (s: RunSummary): string => {
  const noun = s.clipped === 1 ? "coupon" : "coupons";
  const expired = s.expired;
  if (s.total === 0) return "Everything's already clipped!";
  if (s.status === "stopped") return `Stopped. Clipped ${s.clipped} ${noun}.`;
  // Only dead offers were left: nothing to celebrate, nothing to worry about.
  if (s.clipped === 0 && !s.failed && expired) {
    return `Nothing new to clip. All ${expired} remaining offers had already expired at ${s.store}.`;
  }
  const clipped = `Clipped ${s.clipped} ${noun}${s.failed ? `, ${s.failed} failed` : ""}.`;
  const cheer = s.clipped > 0 ? " Nice!" : "";
  const note = expired ? ` ${expired} had already expired at ${s.store} and can't be clipped.` : "";
  return clipped + cheer + note;
};

export const createOverlay = (opts: { autoClip: boolean; onStop: () => void }): OverlayHandle => {
  ensureStyle();
  document.getElementById("cc-overlay")?.remove();
  const el = document.createElement("div");
  el.id = "cc-overlay";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <p id="cc-phase">Clipping in progress… please don't refresh the page.</p>
    <p id="cc-progress-text" aria-live="polite">Clipped 0 / 0</p>
    ${DOTS}
    <div id="cc-bar"><div id="cc-bar-fill"></div></div>
    <button id="cc-stop" type="button">Stop clipping</button>
    ${opts.autoClip ? `<p class="cc-note">${AUTO_CLIP_NOTE}</p>` : ""}
  `;
  document.body.appendChild(el);
  const stop = el.querySelector<HTMLButtonElement>("#cc-stop")!;
  stop.addEventListener("click", () => {
    stop.textContent = "Stopping…";
    stop.disabled = true;
    opts.onStop();
  });
  const q = <T extends HTMLElement>(id: string) => el.querySelector<T>(`#${id}`)!;

  return {
    setPhase: (text) => {
      q("cc-phase").textContent = text;
    },
    setProgress: ({ clipped, expired, failed, total }) => {
      q("cc-progress-text").textContent = [
        `Clipped ${clipped} / ${total}`,
        ...tallyParts({ expired, failed }),
      ].join(" · ");
      const done = clipped + expired + failed;
      q("cc-bar-fill").style.width = total ? `${(done / total) * 100}%` : "0%";
    },
    showSummary: (s) => {
      stop.remove();
      q("cc-phase").textContent = summaryText(s);
      q("cc-bar-fill").style.width = "100%";
    },
    showError: (message) => {
      stop.remove();
      q("cc-phase").textContent = `Something went wrong: ${message}`;
      const close = document.createElement("button");
      close.id = "cc-close";
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => el.remove());
      el.appendChild(close);
    },
    remove: () => el.remove(),
  };
};

// Small non-blocking pill for Count / Load All.
export const createBusyOverlay = (text: string): { remove(): void } => {
  ensureStyle();
  document.getElementById("cc-busy")?.remove();
  const el = document.createElement("div");
  el.id = "cc-busy";
  el.setAttribute("role", "status");
  el.innerHTML = `${DOTS}<span>${text}</span>`;
  document.body.appendChild(el);
  return { remove: () => el.remove() };
};

export const showSignInBanner = (store: StoreConfig) => {
  ensureStyle();
  if (document.getElementById("cc-signin")) return;
  const el = document.createElement("div");
  el.id = "cc-signin";
  el.innerHTML = `
    <span>Sign in to let Coupon Clipper clip your ${store.name} coupons.
      <a href="${getSignInUrl(store)}">Sign in</a></span>
    <button id="cc-signin-dismiss" type="button" aria-label="Dismiss">✕</button>
  `;
  document.body.appendChild(el);
  el.querySelector("#cc-signin-dismiss")!.addEventListener("click", () => el.remove());
};
