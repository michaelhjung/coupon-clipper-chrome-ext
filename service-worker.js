chrome.runtime.onInstalled.addListener(function () {
  console.log("Extension installed");
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      alert("Hello from coupon clipper extension!");
    },
  });
});
