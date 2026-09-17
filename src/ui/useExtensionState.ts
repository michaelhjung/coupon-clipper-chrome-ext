import { useEffect, useState } from "react";

import { sendToWorker } from "../shared/messages";
import { normalizeState } from "../shared/state";

import type { State, WorkerToUi } from "../shared/types";

// Fetches the worker's state once `ready` (the popup waits until it knows
// its tab), then follows the worker's broadcasts.
export const useExtensionState = (tabId?: number, ready = true): State | null => {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!ready) return;
    void sendToWorker<Partial<State>>({ type: "GET_STATE", tabId }).then((s) => {
      if (s) setState(normalizeState(s));
    });
    const listener = (msg: WorkerToUi) => {
      if (msg?.type === "STATE") setState(normalizeState(msg.state));
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, ready]);

  return state;
};
