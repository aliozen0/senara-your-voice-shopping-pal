/**
 * @fileoverview Senara Chrome Extension — Vite Build Konfigürasyonu
 *
 * Bu dosya content script'leri ve background service worker'ı
 * Chrome Extension uyumlu şekilde build etmek için kullanılır.
 *
 * Content script'ler ES module formatını desteklemez,
 * bu yüzden IIFE formatında build edilir.
 *
 * Kullanım:
 *   npm run build:extension
 *   veya
 *   vite build --config vite.config.extension.ts
 *
 * @module vite.config.extension
 */

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // Ana build'in çıktısını silmesin
    rollupOptions: {
      input: {
        background: resolve(__dirname, "background.js"),
        injector: resolve(__dirname, "content_scripts/injector.js"),
        trendyol_cs: resolve(__dirname, "content_scripts/trendyol.js"),
        hepsiburada_cs: resolve(__dirname, "content_scripts/hepsiburada.js"),
        n11_cs: resolve(__dirname, "content_scripts/n11.js"),
      },
      output: {
        format: "iife", // Content script'ler module desteklemez
        entryFileNames: (chunkInfo) => {
          // Content script'leri content_scripts/ alt klasörüne koy
          if (chunkInfo.name.endsWith("_cs") || chunkInfo.name === "injector") {
            const name = chunkInfo.name.replace("_cs", "");
            return `content_scripts/${name}.js`;
          }
          return "[name].js";
        },
        // IIFE'de code-splitting olmaz, her entry bağımsız bir bundle olur
        inlineDynamicImports: false,
      },
    },
    // Minify et ama sourcemap'leri debug için sakla
    minify: "terser",
    sourcemap: true,
  },
  // Extension ortamında process.env vs. yok, defineConfig ile enjekte et
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
