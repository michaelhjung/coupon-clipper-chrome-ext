import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

export const hostMatch = (store) => `https://*.${store.url}/*`;

export function buildManifest(stores, version) {
  const matches = stores.map(hostMatch);
  const byStrategy = (strategy) => stores.filter((s) => s.strategy === strategy).map(hostMatch);
  const albertsonsMatches = byStrategy("albertsons-api");
  const raleysMatches = byStrategy("raleys-dom");
  return {
    manifest_version: 3,
    name: "Coupon Clipper",
    version,
    description:
      "Clip every digital grocery coupon with one click. Supports Albertsons-owned stores (Safeway, Vons, Acme and more) and Raley's.",
    permissions: ["storage", "notifications"],
    host_permissions: matches,
    background: { service_worker: "background.js", type: "module" },
    options_ui: { page: "options.html", open_in_tab: true },
    action: {
      default_popup: "popup.html",
      default_icon: { 128: "icons/icon128.png" },
    },
    icons: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
    content_scripts: [
      { matches, js: ["content.js"], run_at: "document_idle", world: "ISOLATED" },
      // Observes the page's own clip requests; must load before the site's
      // scripts capture XHR/fetch.
      {
        matches: raleysMatches,
        js: ["raleys-page-script.js"],
        run_at: "document_start",
        world: "MAIN",
      },
    ],
    // The content script injects page-script.js on Albertsons sites only.
    web_accessible_resources: [{ resources: ["page-script.js"], matches: albertsonsMatches }],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = buildManifest(read("src/shared/stores.json"), read("package.json").version);
  writeFileSync(join(root, "public/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.info(`Wrote public/manifest.json (v${manifest.version}, ${manifest.host_permissions.length} hosts)`);
}
