import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite-plus";
import { buildContentDb } from "./scripts/content-db";
import { pwa } from "./scripts/pwa-plugin";

/** Builds public/content.sqlite from db/*.sql on start-up and whenever a .sql file changes in dev. */
function contentDb(): Plugin {
  const root = import.meta.dirname;
  return {
    name: "launchpad-content-db",
    async buildStart() {
      console.log(await buildContentDb(root));
    },
    configureServer(server) {
      server.watcher.add(path.join(root, "db"));
      const rebuild = async (file: string) => {
        if (!file.endsWith(".sql") || !file.startsWith(path.join(root, "db"))) return;
        try {
          console.log(await buildContentDb(root));
          server.ws.send({ type: "full-reload" });
        } catch (e) {
          server.config.logger.error(e instanceof Error ? e.message : String(e));
        }
      };
      server.watcher.on("change", rebuild).on("add", rebuild).on("unlink", rebuild);
    },
  };
}

// Relative base + HashRouter => deployable from any static host / sub-path / file share.
export default defineConfig({
  base: "./",
  plugins: [contentDb(), react(), tailwindcss(), pwa()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // SQLite (WebAssembly) runs in a module worker; its wasm file must not be pre-bundled by the dev server.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
});
