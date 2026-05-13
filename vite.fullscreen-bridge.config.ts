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
      entry: resolve(rootDirectory, "src/fullscreen-bridge.ts"),
      fileName: () => "fullscreen-bridge.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerFullscreenBridge",
    },
    rollupOptions: { output: { extend: false } },
  },
});
