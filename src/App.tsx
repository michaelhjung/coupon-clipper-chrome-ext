import "./App.css";
import couponClipperLogo from "/imgs/logo.jpg";

function App() {
  const executeScriptInActiveTab = async (func: () => void) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func,
        });
      } else {
        console.error("No active tab found.");
      }
    } catch (error) {
      console.error("Failed to execute script in active tab:", error);
    }
  };

  const loadAllHandler = async () => {
    await executeScriptInActiveTab(clickLoadMoreButtons);
  };

  const clipAllHandler = async () => {
    await executeScriptInActiveTab(clickLoadMoreButtons);
    await executeScriptInActiveTab(clipAllCoupons);
  };

  const clickLoadMoreButtons = () => {
    return new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
        ) as HTMLButtonElement | undefined;

        if (button) {
          button.click();
          console.info("Clicked 'Load more' button.");
        } else {
          observer.disconnect();
          console.info("No more 'Load more' buttons found.");
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      const initialButton = Array.from(
        document.querySelectorAll("button")
      ).find(
        (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
      ) as HTMLButtonElement | undefined;

      if (initialButton) {
        initialButton.click();
        console.info("Clicked initial 'Load more' button.");
      } else {
        observer.disconnect();
        console.info("No 'Load more' buttons found.");
        resolve();
      }
    });
  };

  const clipAllCoupons = () => {
    const clipCouponButtons = document.querySelectorAll(
      "loyalty-card-action-buttons button"
    );

    let clipCount = 0;

    clipCouponButtons.forEach((element) => {
      const button = element as HTMLButtonElement;
      if (
        button.innerText === "Clip Coupon" ||
        button.innerText === "Activate"
      ) {
        button.click();
        clipCount++;
      }
    });

    alert(`Clipped ${clipCount} ${clipCount === 1 ? "coupon" : "coupons"}!`);
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div>
        <a
          href="https://michaelhjung.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={couponClipperLogo}
            className="logo"
            alt="Coupon Clipper logo"
          />
        </a>
      </div>
      <h1>Coupon Clipper</h1>
      <div className="flex">
        <div className="card">
          <button onClick={loadAllHandler}>Load All</button>
        </div>
        <div className="card">
          <button onClick={clipAllHandler}>Clip All</button>
        </div>
      </div>
    </div>
  );
}

export default App;
