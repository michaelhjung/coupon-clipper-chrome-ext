import { sendToWorker } from "./messages";

declare const ServiceWorkerGlobalScope: unknown;

const LOG_KEY = "logBuffer";
const MAX_LINES = 200;
const PREFIX = "[ coupon clipper ]";

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

const stringify = (args: unknown[]) =>
  args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");

// Worker side: append to the session ring buffer.
export const appendLog = async (line: string) => {
  try {
    const { [LOG_KEY]: buf } = await chrome.storage.session.get(LOG_KEY);
    const lines = Array.isArray(buf) ? (buf as string[]) : [];
    lines.push(line);
    await chrome.storage.session.set({ [LOG_KEY]: lines.slice(-MAX_LINES) });
  } catch {
    /* session storage unavailable */
  }
};

export const getLogs = async (): Promise<string[]> => {
  try {
    const { [LOG_KEY]: buf } = await chrome.storage.session.get(LOG_KEY);
    return Array.isArray(buf) ? (buf as string[]) : [];
  } catch {
    return [];
  }
};

// Everywhere: console + forward to the worker's buffer. Content scripts and
// UI pages send a LOG message; the worker appends directly.
const emit = (level: "info" | "warn" | "error", args: unknown[]) => {
  console[level](PREFIX, ...args);
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${stringify(args)}`;
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  if (typeof ServiceWorkerGlobalScope !== "undefined") {
    void appendLog(line);
  } else {
    void sendToWorker({ type: "LOG", line });
  }
};

export const log = {
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
