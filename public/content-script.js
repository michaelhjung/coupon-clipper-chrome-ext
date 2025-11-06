/* global chrome */

const script = document.createElement("script");
script.src = chrome.runtime.getURL("page-script.js");

script.onload = () => {
  console.info("[ coupon clipper ] Page script loaded successfully!");
  script.remove();
};

(document.head || document.documentElement).append(script);

// Listen for messages from the page context
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "coupon-clipper") return;

  console.info(
    "[ coupon clipper ] Got data from page context:",
    event.data?.payload
  );

  const payload = event.data?.payload || {};

  // Find or create a single hidden element to store the data (avoid duplicates)
  let dataElement = document.getElementById("coupon-clipper-data");
  if (!dataElement) {
    dataElement = document.createElement("div");
    dataElement.style.display = "none";
    dataElement.id = "coupon-clipper-data";
    document.body.appendChild(dataElement);
  }

  // Only set attributes present in the payload; keep previously-set values if absent
  const safeSet = (attrName, value) => {
    if (value === undefined || value === null) return;
    dataElement.setAttribute(`data-${attrName}`, String(value));
  };

  safeSet("store-id", payload.storeId);
  safeSet("client-id", payload.clientId);
  safeSet("client-secret", payload.clientSecret);
  safeSet("correlation-id", payload.correlationId);
  safeSet("access-token", payload.token);

  // Mark the element as "ready" when at least the access token exists OR we've explicitly marked ready
  if (payload.token) dataElement.setAttribute("data-ready", "1");
});
