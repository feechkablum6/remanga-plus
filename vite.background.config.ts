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
      entry: resolve(rootDirectory, "src/background.ts"),
      fileName: () => "background.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerBackground",
    },
    rollupOptions: {
      output: {
        extend: false,
      },
    },
  },
});
