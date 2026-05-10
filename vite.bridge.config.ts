import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(rootDirectory, "src/mangalib-bridge.ts"),
      fileName: () => "mangalib-bridge.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerMangalibBridge",
    },
    rollupOptions: { output: { extend: false } },
  },
});
