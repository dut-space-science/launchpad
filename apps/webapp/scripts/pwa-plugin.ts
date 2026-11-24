import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite-plus";

/**
 * Files in the build that the service worker must not store: itself, Netlify's headers file, source maps, and the
 * older .woff and .ttf copies of fonts (every browser that can install the app reads the .woff2 copy).
 */
const SKIP = (rel: string) =>
  rel === "sw.js" || rel.startsWith("_") || /\.(map|woff|ttf)$/.test(rel);

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

/**
 * Writes dist/sw.js after the build: scripts/sw-template.js with the list of every file in the build, so the app
 * (including its SQLite WebAssembly and the course database) works offline, and a version that changes whenever any
 * of those files does, so installed copies know to update.
 */
export function pwa(): Plugin {
  let outDir = "";
  const root = import.meta.dirname;
  return {
    name: "launchpad-pwa",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: "post",
      async handler() {
        const files = (await walk(outDir)).filter((f) => !SKIP(f)).sort();
        const hash = createHash("sha256");
        for (const f of files) {
          hash.update(f);
          hash.update(await readFile(path.join(outDir, f)));
        }
        const version = hash.digest("hex").slice(0, 12);
        // "./" stands for index.html and is listed too, so the bare site address works offline.
        const list = JSON.stringify(["./", ...files], null, 2);
        const template = await readFile(path.join(root, "sw-template.js"), "utf8");
        await writeFile(
          path.join(outDir, "sw.js"),
          template.replace("__VERSION__", version).replace("__PRECACHE__", list),
        );
        console.log(`sw.js: ${files.length} files precached, version ${version}`);
      },
    },
  };
}
