import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version as string;

export default defineConfig({
  plugins: [react()],
  define: { __MEMORY_ONE_VERSION__: JSON.stringify(packageVersion) },
  publicDir: false,
  build: { outDir: "public", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8765", "/mcp": "http://127.0.0.1:8765" },
  },
});
