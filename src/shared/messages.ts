import type { ContentToWorker, UiToWorker, WorkerToContent, WorkerToUi } from "./types";

// All helpers swallow "no receiver" errors: a closed popup or a tab without
// our content script is normal, not a failure.
const sendRuntime = async <T>(msg: unknown): Promise<T | undefined> => {
  try {
    return (await chrome.runtime.sendMessage(msg)) as T;
  } catch {
    return undefined;
  }
};

export const sendToWorker = <T = unknown>(msg: ContentToWorker | UiToWorker) => sendRuntime<T>(msg);

export const broadcast = async (msg: WorkerToUi): Promise<void> => {
  await sendRuntime(msg);
};

export const sendToTab = async <T = unknown>(
  tabId: number,
  msg: WorkerToContent
): Promise<T | undefined> => {
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    return undefined; // tab has no content script
  }
};
