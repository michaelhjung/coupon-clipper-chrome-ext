import { vi } from "vitest";

type Area = Record<string, unknown>;

const makeArea = () => {
  let data: Area = {};
  return {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
    }),
    set: vi.fn(async (items: Area) => {
      data = { ...data, ...items };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    }),
    clear: vi.fn(async () => {
      data = {};
    }),
    setAccessLevel: vi.fn(async () => undefined),
  };
};

export const resetChromeMock = () => {
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      getManifest: () => ({ version: "0.0.0-test" }),
      getURL: (p: string) => `chrome-extension://test/${p}`,
      openOptionsPage: vi.fn(),
    },
    storage: {
      local: makeArea(),
      session: makeArea(),
      sync: makeArea(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { sendMessage: vi.fn(async () => undefined), query: vi.fn(async () => []) },
  };
};

resetChromeMock();

// vitest's jsdom environment does not expose Web Storage; give the adapters a
// minimal in-memory stand-in so code that touches localStorage can run.
if (typeof (globalThis as any).localStorage === "undefined") {
  let store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => {
      store = new Map();
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}
