/* global chrome */

// Ensure the script only runs on the specific URL
const script = document.createElement("script");
script.src = chrome.runtime.getURL("page-script.js");

// When the script is loaded, remove it from the DOM
script.onload = () => {
  console.log("Page script loaded successfully!");
  script.remove();
};

// Append the script to the page
(document.head || document.documentElement).append(script);

// Listen for messages from the page context
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.source === "coupon-clipper") {
    console.log("Got data from page context:", event.data.payload);
  }
});
