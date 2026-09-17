import { createAlbertsonsAdapter } from "./albertsons";
import { createCvsAdapter } from "./cvs";
import { createRaleysAdapter } from "./raleys";

import type { StoreAdapter } from "./types";
import type { StoreConfig } from "../shared/types";

export const createAdapter = (store: StoreConfig): StoreAdapter => {
  switch (store.strategy) {
    case "raleys-dom":
      return createRaleysAdapter(store);
    case "cvs-api":
      return createCvsAdapter(store);
    default:
      return createAlbertsonsAdapter(store);
  }
};
