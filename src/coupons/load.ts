import { executeScriptInActiveTab } from "../utils/chrome";

export const loadAllHandler = async (
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setLoading(true);

  const couponsLoaded = await executeScriptInActiveTab(clickLoadMoreButtons);
  setLoading(false);

  if (couponsLoaded) alert("All coupons loaded!");
};

export const clickLoadMoreButtons = () => {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => (el as HTMLButtonElement).innerText.trim() === "Load more"
      ) as HTMLButtonElement | undefined;

      if (button) {
        button.click();

        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });

        console.info("Clicked 'Load more' button.");
      } else {
        observer.disconnect();
        console.info("No more 'Load more' buttons found.");
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const initialButton = Array.from(document.querySelectorAll("button")).find(
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
