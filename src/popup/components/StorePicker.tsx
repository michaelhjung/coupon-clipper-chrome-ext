import { useState } from "react";

import { getCouponPageUrl, getStoreByName, STORES } from "../../shared/constants";
import { setSettings } from "../../shared/storage";

interface Props {
  tab: chrome.tabs.Tab | null;
  currentStore?: string;
  lastStore: string | null;
}

export const StorePicker = ({ tab, currentStore, lastStore }: Props) => {
  const [selected, setSelected] = useState(lastStore ?? "");

  return (
    <div className="flex items-center gap-2">
      <select
        className="min-w-0 flex-1 rounded-md border border-slate-500/30 bg-transparent p-2"
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          void setSettings({ lastStore: e.target.value || null });
        }}
      >
        <option value="">Select a store</option>
        {STORES.map((s) => (
          <option key={s.name} value={s.name} disabled={s.name === currentStore}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        className="primary"
        disabled={!selected || selected === currentStore}
        onClick={() => {
          const s = getStoreByName(selected);
          if (s) void chrome.tabs.create({ url: getCouponPageUrl(s), windowId: tab?.windowId });
        }}
      >
        Go
      </button>
    </div>
  );
};
