import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const fixturesDir = fileURLToPath(new URL("../demo/fixtures", import.meta.url));
const TYPES: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };

// Serves demo/fixtures at /fixtures so the offline sample guide can show its step images.
function serveFixtures(): Plugin {
  return {
    name: "serve-fixtures",
    configureServer(server) {
      server.middlewares.use("/fixtures", (req, res, next) => {
        const file = normalize(join(fixturesDir, decodeURIComponent((req.url ?? "/").split("?")[0])));
        if (!file.startsWith(fixturesDir) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveFixtures()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: { "/api": process.env.API_URL ?? "http://localhost:8000" },
    fs: { allow: [".."] }, // lets the app import demo/fixtures
  },
});
