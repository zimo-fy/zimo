import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export const websiteServerOptions = {
  host: "0.0.0.0",
  port: 5174,
  strictPort: true,
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: websiteServerOptions,
  preview: websiteServerOptions,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
