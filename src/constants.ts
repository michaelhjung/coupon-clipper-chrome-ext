import { generateUUID } from "./utils/general";

export const VERSION = "1.2.1";

export const CHROME_EXT_URL =
  "https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded";

export const DEFAULT_STORE_ID = "3132";
export const DEFAULT_CLIENT_ID = "306b9569-2a31-4fb9-93aa-08332ba3c55d";
export const DEFAULT_CLIENT_SECRET =
  "N4tK3pW7pP6nB4kL6vN4kW0rS5lE4qH2fY0aB2rK1eP5gK4yV5";
export const DEFAULT_CORRELATION_ID = generateUUID();

export const STORES = [
  {
    name: "Acme",
    url: "acmemarkets.com",
  },
  {
    name: "Albertsons",
    url: "albertsons.com",
  },
  {
    name: "Andronico's",
    url: "andronicos.com",
  },
  {
    name: "Balducci's",
    url: "balduccis.com",
  },
  {
    name: "Carrs",
    url: "carrsqc.com",
  },
  {
    name: "Haggen",
    url: "haggen.com",
  },
  {
    name: "Jewel-Osco",
    url: "jewelosco.com",
  },
  {
    name: "Kings Food Markets",
    url: "kingsfoodmarkets.com",
  },
  {
    name: "Pavilions",
    url: "pavilions.com",
  },
  {
    name: "Randalls",
    url: "randalls.com",
  },
  {
    name: "Safeway",
    url: "safeway.com",
  },
  {
    name: "Shaw's",
    url: "shaws.com",
  },
  {
    name: "Star Market",
    url: "starmarket.com",
  },
  {
    name: "Tom Thumb",
    url: "tomthumb.com",
  },
  {
    name: "Vons",
    url: "vons.com",
  },
];
