import { createAlbertsonsAdapter } from "./albertsons";
import { createRaleysAdapter } from "./raleys";

import type { StoreAdapter } from "./types";
import type { StoreConfig } from "../shared/types";

export const createAdapter = (store: StoreConfig): StoreAdapter =>
  store.strategy === "raleys-dom" ? createRaleysAdapter(store) : createAlbertsonsAdapter(store);
