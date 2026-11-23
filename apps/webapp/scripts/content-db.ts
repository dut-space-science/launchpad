import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

/**
 * Builds the content database that ships with the app: db/schema.sql, then db/seed/*.sql in name order.
 * Writes public/content.sqlite and returns a one-line summary. Throws if a seed is invalid or breaks a foreign key.
 */
export async function buildContentDb(root = process.cwd()) {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");
  try {
    db.exec(readFileSync(join(root, "db/schema.sql"), "utf8"));
    const seeds = readdirSync(join(root, "db/seed"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of seeds) {
      try {
        db.exec(readFileSync(join(root, "db/seed", f), "utf8"));
      } catch (e) {
        throw new Error(`db/seed/${f}: ${e instanceof Error ? e.message : String(e)}`, {
          cause: e,
        });
      }
    }
    const bad = db.exec({ sql: "PRAGMA foreign_key_check", returnValue: "resultRows" });
    if (bad.length) throw new Error(`Foreign key violations: ${JSON.stringify(bad)}`);

    db.exec("VACUUM");
    const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer!);
    mkdirSync(join(root, "public"), { recursive: true });
    writeFileSync(join(root, "public/content.sqlite"), bytes);
    copyFileSync(join(root, "db/schema.sql"), join(root, "public/content-schema.sql")); // for authors of their own courses
    return `content.sqlite: ${seeds.length} seed files, ${(bytes.length / 1024).toFixed(0)} kB`;
  } finally {
    db.close();
  }
}
