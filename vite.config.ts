/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Popup, options page and the background service worker. The content script
// is built separately (vite.content.config.ts) because it must be one IIFE.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: "popup.html",
        options: "options.html",
        background: "src/background/index.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
