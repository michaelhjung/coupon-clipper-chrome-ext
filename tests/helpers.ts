import type { AlbertsonsSession } from "../src/content/pageBridge";

export const jsonResponse = (status: number, body: unknown, text = JSON.stringify(body)) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body, text: async () => text }) as Response;

// Adapters attach a MutationObserver to <body>; swap in a fresh body so an
// observer left over from a previous test cannot touch this one's DOM.
export const render = (html: string) => {
  document.body = document.createElement("body");
  document.body.innerHTML = html;
};

// Lets queued MutationObserver callbacks and resolved promises run.
export const flush = () => new Promise<void>((r) => setTimeout(r, 0));

export const albertsonsSession = (storeId: string): AlbertsonsSession => ({
  storeId,
  clientId: "cid",
  clientSecret: "sec",
  correlationId: "corr",
  token: "tok",
});
