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
  if (event.data?.source === "coupon-clipper") {
    console.info(
      "[ coupon clipper ] Got data from page context:",
      event.data?.payload
    );
  }

  // Create a hidden element to store the data
  const dataElement = document.createElement("div");
  dataElement.style.display = "none";
  dataElement.id = "coupon-clipper-data";
  dataElement.setAttribute("data-store-id", event.data?.payload?.storeId);
  dataElement.setAttribute("data-client-id", event.data?.payload?.clientId);
  dataElement.setAttribute(
    "data-client-secret",
    event.data?.payload?.clientSecret
  );
  dataElement.setAttribute(
    "data-correlation-id",
    event.data?.payload?.correlationId
  );
  dataElement.setAttribute("data-access-token", event.data?.payload?.token);

  // Append the element to the body (or head)
  document.body.appendChild(dataElement);
});
