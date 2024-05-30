document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("myButton").addEventListener("click", async () => {
    // alert("Button clicked!");
    let [tab] = await chrome.tabs.query({ active: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        alert("Welcome!!");
      },
    });
  });
});
