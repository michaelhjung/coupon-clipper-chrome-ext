import { useEffect, useState } from "react";

import { getStoreFromUrl, isCouponPageUrl } from "../shared/constants";

import type { StoreConfig } from "../shared/types";

export interface ActiveTabInfo {
  tab: chrome.tabs.Tab | null;
  store: StoreConfig | undefined;
  onCouponPage: boolean;
  loaded: boolean;
}

export const useActiveTab = (): ActiveTabInfo => {
  const [info, setInfo] = useState<ActiveTabInfo>({
    tab: null,
    store: undefined,
    onCouponPage: false,
    loaded: false,
  });
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const url = tab?.url ?? "";
      setInfo({
        tab: tab ?? null,
        store: getStoreFromUrl(url),
        onCouponPage: isCouponPageUrl(url),
        loaded: true,
      });
    });
  }, []);
  return info;
};
