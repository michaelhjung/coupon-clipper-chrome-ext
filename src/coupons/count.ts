import { clickLoadMoreButtons } from "./load";
import { executeScriptInActiveTab } from "../utils/chrome";

export const countAllHandler = async (
  setCounting: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setCounting(true);

  const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
  if (!couponsLoaded) return setCounting(false);

  await executeScriptInActiveTab(countAvailableCoupons);
  setCounting(false);
};

const countAvailableCoupons = async () => {
  const couponButtons = Array.from(
    document.querySelectorAll("loyalty-card-action-buttons button")
  ) as HTMLButtonElement[];
  const couponButtonInnerTexts = ["clip coupon", "activate"];
  const filteredCouponButtons =
    couponButtons.filter((button) =>
      couponButtonInnerTexts.includes(button.innerText.trim().toLowerCase())
    ) || [];

  chrome.runtime.sendMessage({
    type: "COUNT_COUPONS_DONE",
    count: filteredCouponButtons.length,
  });
};
