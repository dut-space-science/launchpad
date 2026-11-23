import sqlite3InitModule, { type Database, type Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import type { Statement, Rows } from "./codec";
import { CONTENT_SCHEMA_SQL, DATA_TABLES, MIGRATIONS, SCHEMA_VERSION } from "./schema";
import { CONTENT_TABLES, type ContentRows } from "../../content/codec";

/**
 * SQLite running in a Web Worker, storing its file in the browser's private file system (OPFS) through the
 * "SAH pool" VFS, which needs no special server headers. Requests are {id, type, ...}; replies are {id, ok, ...}.
 */
type Req =
  | { id: number; type: "init" }
  | { id: number; type: "batch"; statements: Statement[] }
  | { id: number; type: "readAll" }
  | { id: number; type: "meta"; key: string; value?: string }
  | { id: number; type: "export" }
  | { id: number; type: "wipe" }
  | { id: number; type: "contentRows" }
  | { id: number; type: "content"; bytes: Uint8Array; kind: "sqlite" | "sql" };

interface Scope {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
}
const ctx = self as unknown as Scope;

let sqlite3: Sqlite3Static;
let db: Database;

/** The SQLite WebAssembly module, started once and shared by the content and learner databases. */
let ready: Promise<Sqlite3Static> | undefined;
const sqlite = () => (ready ??= sqlite3InitModule().then((m) => (sqlite3 = m)));

/**
 * Read a course library into rows, from either a SQLite file or a .sql script that is run on top of the Launchpad
 * content schema. Either way the result is checked against the schema's foreign keys. Throws a readable message
 * if the file is not a valid course library.
 */
async function readContent(bytes: Uint8Array, kind: "sqlite" | "sql"): Promise<ContentRows> {
  const api = await sqlite();
  const mem = new api.oo1.DB(":memory:");
  try {
    if (kind === "sql") {
      mem.exec(CONTENT_SCHEMA_SQL);
      mem.exec(new TextDecoder().decode(bytes));
    } else {
      const p = api.wasm.allocFromTypedArray(bytes);
      const rc = api.capi.sqlite3_deserialize(
        mem.pointer!,
        "main",
        p,
        bytes.length,
        bytes.length,
        api.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
      );
      if (rc !== 0) throw new Error("This is not a SQLite file");
    }
    const bad = mem.exec({ sql: "PRAGMA foreign_key_check", returnValue: "resultRows" });
    if (bad.length) throw new Error(`${bad.length} rows refer to something that does not exist`);
    const rows = {} as ContentRows;
    for (const t of CONTENT_TABLES)
      rows[t] = mem.exec({
        sql: `SELECT * FROM ${t}`,
        rowMode: "object",
        returnValue: "resultRows",
      }) as Record<string, unknown>[];
    return rows;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/no such table|not a database|no such column|has no column/i.test(m))
      throw new Error("This file does not follow the Launchpad course schema", { cause: e });
    if (/FOREIGN KEY/i.test(m))
      throw new Error(
        "Some rows refer to something that does not exist, for example a course whose discipline_id is not in disciplines",
        { cause: e },
      );
    if (/UNIQUE|PRIMARY KEY/i.test(m))
      throw new Error("Two rows have the same id where ids must be unique", { cause: e });
    if (/NOT NULL|CHECK/i.test(m))
      throw new Error("A row has a missing or invalid value (see db/schema.sql)", { cause: e });
    if (/syntax error/i.test(m))
      throw new Error(`The SQL could not be read: ${m.replace(/^.*?:\s*/, "")}`, { cause: e });
    throw e instanceof Error ? e : new Error(m);
  } finally {
    mem.close();
  }
}

async function init() {
  await sqlite();
  const pool = await sqlite3.installOpfsSAHPoolVfs({
    name: "launchpad-opfs",
    directory: "/launchpad",
    initialCapacity: 6,
  });
  db = new pool.OpfsSAHPoolDb("/launchpad.db");
  db.exec("PRAGMA foreign_keys = ON");
  const current = Number(db.selectValue("PRAGMA user_version") ?? 0);
  for (const m of MIGRATIONS.filter((x) => x.version > current)) {
    db.transaction(() => {
      for (const sql of m.sql) db.exec(sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
    });
  }
  return { version: SCHEMA_VERSION, sqlite: sqlite3.version.libVersion };
}

function readAll(): Rows {
  const rows: Rows = {};
  for (const t of DATA_TABLES)
    rows[t] = db.exec({
      sql: `SELECT * FROM ${t}`,
      rowMode: "object",
      returnValue: "resultRows",
    }) as Record<string, unknown>[];
  return rows;
}

/** The course content installed in the browser database. */
function readInstalledContent(): ContentRows {
  const rows = {} as ContentRows;
  for (const t of CONTENT_TABLES)
    rows[t] = db.exec({
      sql: `SELECT * FROM ${t}`,
      rowMode: "object",
      returnValue: "resultRows",
    }) as Record<string, unknown>[];
  return rows;
}

ctx.onmessage = async (e) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "init":
        ctx.postMessage({ id: req.id, ok: true, ...(await init()) });
        break;
      case "batch":
        db.transaction(() => {
          for (const s of req.statements) db.exec({ sql: s.sql, bind: s.bind });
        });
        ctx.postMessage({ id: req.id, ok: true });
        break;
      case "readAll":
        ctx.postMessage({ id: req.id, ok: true, rows: readAll() });
        break;
      case "meta": {
        if (req.value !== undefined) {
          db.exec({
            sql: `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            bind: [req.key, req.value],
          });
          ctx.postMessage({ id: req.id, ok: true });
        } else {
          const v = db.selectValue("SELECT value FROM meta WHERE key = ?", [req.key]);
          ctx.postMessage({ id: req.id, ok: true, value: v ?? null });
        }
        break;
      }
      case "content":
        ctx.postMessage({ id: req.id, ok: true, rows: await readContent(req.bytes, req.kind) });
        break;
      case "contentRows":
        ctx.postMessage({ id: req.id, ok: true, rows: readInstalledContent() });
        break;
      case "wipe":
        // Empty every table (learner data and installed course content) in one transaction, then give the freed
        // pages back to the file. The content markers in `meta` go too, so the app starts again at first-run setup.
        db.transaction(() => {
          db.exec("PRAGMA defer_foreign_keys = ON");
          for (const t of [...DATA_TABLES, ...CONTENT_TABLES]) db.exec(`DELETE FROM ${t}`);
          db.exec(`DELETE FROM meta WHERE key LIKE 'content_%'`);
        });
        db.exec("VACUUM");
        ctx.postMessage({ id: req.id, ok: true });
        break;
      case "export": {
        const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer!);
        ctx.postMessage({ id: req.id, ok: true, bytes }, [bytes.buffer]);
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      ok: false,
      error:
        err instanceof Error
          ? err.name === "Error"
            ? err.message
            : `${err.name}: ${err.message}`
          : String(err),
    });
  }
};
