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
      entry: resolve(rootDirectory, "src/remanga-bridge.ts"),
      fileName: () => "remanga-bridge.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerRemangaBridge",
    },
    rollupOptions: { output: { extend: false } },
  },
});
