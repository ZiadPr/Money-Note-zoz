import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    host: host || "::",
    port: 5173,
    strictPort: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5174,
          overlay: false,
        }
      : {
          overlay: false,
        },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
