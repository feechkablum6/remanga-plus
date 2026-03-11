import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(rootDirectory, "src/content.ts"),
      fileName: () => "content.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancer",
    },
    rollupOptions: {
      output: {
        extend: false,
      },
    },
  },
});
