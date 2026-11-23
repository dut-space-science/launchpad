import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import {
  CONTENT_TABLES,
  contentFromRows,
  installStatements,
  type Content,
  type ContentRows,
} from "./codec";

// Tests the database that ships to the browser (run `pnpm run build:db` first; `pnpm test` does).
let content: Content;
let shippedRows: ContentRows;
let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>;
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");
  const bytes = new Uint8Array(readFileSync("public/content.sqlite"));
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer!,
    "main",
    sqlite3.wasm.allocFromTypedArray(bytes),
    bytes.length,
    bytes.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
  );
  expect(rc).toBe(0);
  const rows = {} as ContentRows;
  for (const t of CONTENT_TABLES)
    rows[t] = db.exec({
      sql: `SELECT * FROM ${t}`,
      rowMode: "object",
      returnValue: "resultRows",
    }) as Record<string, unknown>[];
  shippedRows = rows;
  content = contentFromRows(rows);
});

describe("shipped content database", () => {
  it("holds the knowledge tree and at least one course", () => {
    expect(content.fields.length).toBe(5);
    expect(content.fields.flatMap((f) => f.disciplines).length).toBe(21);
    expect(content.courses.length).toBeGreaterThan(0);
  });

  it("gives every course complete, well-formed content", () => {
    const disciplines = new Set(content.fields.flatMap((f) => f.disciplines.map((d) => d.id)));
    for (const c of content.courses) {
      expect(disciplines.has(c.discipline)).toBe(true);
      for (const d of c.alsoDisciplines ?? []) expect(disciplines.has(d)).toBe(true);
      expect(c.modules.length).toBeGreaterThan(0);
      const lessonIds = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
      expect(new Set(lessonIds).size).toBe(lessonIds.length);
      for (const m of c.modules) {
        expect(m.lessons.length).toBeGreaterThan(0);
        for (const q of m.quiz) {
          expect(q.options.length).toBeGreaterThan(1);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
        }
        for (const l of m.lessons) {
          expect(l.blocks.length).toBeGreaterThan(0);
          expect(l.takeaways.length).toBeGreaterThan(0);
        }
      }
      const units = new Set(c.modules.map((m) => m.id));
      for (const g of c.glossary) if (g.unit) expect(units.has(g.unit)).toBe(true);
      for (const f of c.databank?.facts ?? []) expect(units.has(f.unit)).toBe(true);
      for (const p of c.practice ?? [])
        for (const pr of p.problems) {
          if (pr.kind === "mcq") expect(pr.options?.[pr.answer ?? -1]).toBeDefined();
          if (pr.kind === "numeric") expect(pr.numeric).toBeDefined();
        }
    }
  });
});

describe("installing the content into the browser database", () => {
  const readInstalled = (db: InstanceType<typeof sqlite3.oo1.DB>) => {
    const rows = {} as ContentRows;
    for (const t of CONTENT_TABLES)
      rows[t] = db.exec({
        sql: `SELECT * FROM ${t}`,
        rowMode: "object",
        returnValue: "resultRows",
      }) as Record<string, unknown>[];
    return rows;
  };
  const apply = (
    db: InstanceType<typeof sqlite3.oo1.DB>,
    st: { sql: string; bind: (string | number | null)[] }[],
  ) =>
    db.transaction(() => {
      for (const s of st) db.exec({ sql: s.sql, bind: s.bind });
    });
  const freshBrowserDb = () => {
    const db = new sqlite3.oo1.DB(":memory:");
    db.exec(readFileSync("db/schema.sql", "utf8"));
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.exec("PRAGMA foreign_keys = ON");
    return db;
  };

  it("copies every table faithfully and can be repeated (an update replaces the old copy)", () => {
    const db = freshBrowserDb();
    apply(db, installStatements(shippedRows, "v1"));
    expect(contentFromRows(readInstalled(db))).toEqual(content);
    apply(db, installStatements(shippedRows, "v2"));
    expect(contentFromRows(readInstalled(db))).toEqual(content);
    expect(db.selectValue("SELECT value FROM meta WHERE key = 'content_version'")).toBe("v2");
    expect(db.selectValue("SELECT value FROM meta WHERE key = 'content_source'")).toBe("default");
    db.close();
  });
});
