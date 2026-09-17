import { defineConfig } from "vite";

// Content scripts cannot use ES module imports, so bundle to a single IIFE.
export default defineConfig({
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: "src/content/index.ts",
      formats: ["iife"],
      name: "CouponClipperContent",
      fileName: () => "content.js",
    },
  },
});
