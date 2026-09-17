// Runs in raleys.com's MAIN world at document_start (declared in the
// manifest). The content script cannot see the page's own network traffic,
// so this wraps XHR and fetch and reports every clip request's outcome; the
// site's own "Clip" button changes before the server answers, so the button
// alone cannot tell a clip from a rejection.
(() => {
  // Both /api/offers/accept (store offers) and /api/offers/accept-coupons
  // (manufacturer coupons).
  const CLIP_PATH = "/api/offers/accept";
  let seq = 0;

  const post = (message) =>
    window.postMessage({ source: "coupon-clipper", ...message }, "*");
  const isClip = (input) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    return typeof url === "string" && url.includes(CLIP_PATH);
  };

  // The body of a rejection says why (e.g. the offer hit its limit); a
  // success body is not needed.
  const BODY_LIMIT = 300;
  const respond = (id, status, body) =>
    post({
      type: "raleys-clip-response",
      seq: id,
      status,
      body: status >= 200 && status < 300 ? "" : String(body ?? "").slice(0, BODY_LIMIT),
    });

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isClip(url)) {
      const id = ++seq;
      this.addEventListener("loadstart", () => post({ type: "raleys-clip-request", seq: id }));
      this.addEventListener("loadend", () => {
        let body = "";
        try {
          body = this.responseType === "" || this.responseType === "text" ? this.responseText : "";
        } catch {
          /* body not readable as text */
        }
        respond(id, this.status, body);
      });
    }
    return open.call(this, method, url, ...rest);
  };

  const fetch = window.fetch;
  window.fetch = function (input, init) {
    if (!isClip(input)) return fetch.call(this, input, init);
    const id = ++seq;
    post({ type: "raleys-clip-request", seq: id });
    const result = fetch.call(this, input, init);
    result.then(
      (response) =>
        response.ok
          ? respond(id, response.status, "")
          : response
              .clone()
              .text()
              .then((body) => respond(id, response.status, body), () => respond(id, response.status, "")),
      () => respond(id, 0, "network error")
    );
    return result;
  };

  document.documentElement.dataset.ccRaleysBridge = "1";
})();
