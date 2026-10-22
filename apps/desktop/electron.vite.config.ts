import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: resolve("src/main/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
          chunkFileNames: "chunks/[name]-[hash].cjs",
          // Electron exposes a few built-ins through namespace proxies whose enumerable keys do
          // not all have descriptors. Rollup's live-binding interop assumes those descriptors
          // exist, which breaks the bundled Transformers lazy chunk at runtime.
          externalLiveBindings: false,
        },
        // officeparser dynamically resolves ESM parsers/workers and must retain its Node runtime
        // layout. Transformers' Node build is bundled; native/runtime-loaded modules stay external.
        external: [
          "officeparser",
          "onnxruntime-common",
          "onnxruntime-node",
          "sharp",
          "puppeteer",
        ],
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
        output: { format: "cjs", entryFileNames: "index.cjs" },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
