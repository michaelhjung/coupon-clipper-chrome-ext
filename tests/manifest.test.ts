import { describe, expect, it } from "vitest";

import { buildManifest, hostMatch } from "../scripts/generate-manifest.mjs";
import stores from "../src/shared/stores.json";

describe("buildManifest", () => {
  const manifest = buildManifest(stores, "2.0.0");

  it("uses the given version", () => {
    expect(manifest.version).toBe("2.0.0");
  });

  it("lists every store host in host_permissions and the content script", () => {
    const hosts = stores.map(hostMatch);
    expect(manifest.host_permissions).toEqual(hosts);
    expect(manifest.content_scripts[0].matches).toEqual(hosts);
  });

  it("exposes page-script.js to the Albertsons sites that inject it", () => {
    const albertsons = stores.filter((s) => s.strategy === "albertsons-api").map(hostMatch);
    expect(manifest.web_accessible_resources[0].matches).toEqual(albertsons);
    expect(albertsons.length).toBeGreaterThan(0);
  });

  it("runs the Raley's network bridge in the page's main world on Raley's only", () => {
    const raleys = stores.filter((s) => s.strategy === "raleys-dom").map(hostMatch);
    const bridge = manifest.content_scripts.find((c) => c.js.includes("raleys-page-script.js"))!;
    expect(bridge).toMatchObject({ matches: raleys, world: "MAIN", run_at: "document_start" });
    expect(raleys.length).toBeGreaterThan(0);
  });

  it("mentions CVS in the store description", () => {
    expect(manifest.description).toContain("CVS");
  });

  it("does not request the tabs permission", () => {
    expect(manifest.permissions).not.toContain("tabs");
  });
});
