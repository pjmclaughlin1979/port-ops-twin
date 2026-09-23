import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    // Fixed port: it must match a redirect URI registered on the ArcGIS
    // Online OAuth app, so fail loudly rather than drift to another port.
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
});
