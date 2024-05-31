import "./App.css";
import couponClipperLogo from "/imgs/logo.jpg";

function App() {
  const clickHandler = async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => {
        alert("Hello from Coupon Clipper!");
      },
    });
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div>
        <a href="https://michaelhjung.com" target="_blank">
          <img
            src={couponClipperLogo}
            className="logo"
            alt="Coupon Clipper logo"
          />
        </a>
      </div>
      <h1>Coupon Clipper</h1>
      <div className="card">
        <button onClick={clickHandler}>Click Me</button>
      </div>
    </div>
  );
}

export default App;
