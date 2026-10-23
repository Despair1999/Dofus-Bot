import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2022", outDir: "dist", assetsInlineLimit: 4096 },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } },
});
