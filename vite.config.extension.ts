/**
 * @fileoverview Senara Chrome Extension — Vite Build
 *
 * Tüm extension bileşenlerini tek seferde build eder:
 * - sidepanel.html + sidepanel.jsx (React side panel UI + Tailwind CSS)
 * - background.js (service worker)
 * - content_scripts/*.js (injector + site-specific)
 */

import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "extension/sidepanel.html"),
        // background.js Vite'dan geçmez — chrome.* API'leri tree-shake edilir!
        // Build script'te doğrudan kopyalanır.
        injector: resolve(__dirname, "content_scripts/injector.js"),
        trendyol: resolve(__dirname, "content_scripts/trendyol.js"),
        hepsiburada: resolve(__dirname, "content_scripts/hepsiburada.js"),
        n11: resolve(__dirname, "content_scripts/n11.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const contentScripts = ["injector", "trendyol", "hepsiburada", "n11"];
          if (contentScripts.includes(chunkInfo.name)) {
            return `content_scripts/${chunkInfo.name}.js`;
          }
          return "[name].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    minify: false,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
