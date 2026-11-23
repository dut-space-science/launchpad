import { beforeAll, describe, expect, it } from "vite-plus/test";
import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import { initialState, type State } from "@/store/state";
import { diffState, stateFromRows, type Rows, type Statement } from "./codec";
import { DATA_TABLES, MIGRATIONS } from "./schema";

// Real SQLite (the node build of the same WebAssembly library the browser uses), in memory.
let sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>;
beforeAll(async () => {
  sqlite3 = await sqlite3InitModule();
});

function freshDb(): Database {
  const db = new sqlite3.oo1.DB(":memory:");
  for (const m of MIGRATIONS) for (const sql of m.sql) db.exec(sql);
  return db;
}
function apply(db: Database, statements: Statement[]) {
  db.transaction(() => {
    for (const s of statements) db.exec({ sql: s.sql, bind: s.bind });
  });
}
function read(db: Database): State {
  const rows: Rows = {};
  for (const t of DATA_TABLES)
    rows[t] = db.exec({
      sql: `SELECT * FROM ${t}`,
      rowMode: "object",
      returnValue: "resultRows",
    }) as Record<string, unknown>[];
  return stateFromRows(rows);
}

const sample = (): State => ({
  ...initialState(),
  profile: { name: "Phahla M" },
  last: { course: "svde", lesson: "sdof-oscillator" },
  focusMode: true,
  volume: { music: 63, lessons: 30 },
  enrolled: { svde: 1700000000000 },
  completed: { "svde/why-rockets-shake": 1700000001000, "svde/sdof-oscillator": 1700000002000 },
  quizzes: { "svde/m1": { best: 0.95, last: 0.83, attempts: 3, passed: true, at: 1700000003000 } },
  notes: {
    "svde/why-rockets-shake": "# Hello\n\n$f_n = 1$ and 'quotes'; DROP TABLE notes; -- \" done",
    "svde/sdof-oscillator": "second",
  },
  bookmarks: { "svde/sdof-oscillator": 1700000004000 },
  pins: { "svde/f:sdof-oscillator:0": 1700000005000 },
  cards: { "svde/IEPE / ICP": { box: 2, due: 1700000006000 }, "svde/Pogo": { box: 0, due: 0 } },
  practice: { "svde/m1-problems": { best: 0.5, last: 0.5, attempts: 1, at: 1700000007000 } },
  activity: { "2026-11-23": 4, "2026-11-22": 1 },
  focus: { "2026-11-23": 50 },
  streams: [
    { id: "b", label: "Second", kind: "playlist", ref: "PL123" },
    { id: "a", label: "First", kind: "video", ref: "abcdefghijk" },
  ],
  labState: { srs: { amplitude: 100, notes: ["x"] } },
});

describe("SQLite persistence codec", () => {
  it("round-trips every field of the state, including odd text and keys containing a slash", () => {
    const db = freshDb();
    apply(db, diffState(initialState(), sample()));
    expect(read(db)).toEqual(sample());
    db.close();
  });

  it("writes only what changed, and handles updates, additions, deletions and reordering", () => {
    const db = freshDb();
    const a = sample();
    apply(db, diffState(initialState(), a));

    const b: State = {
      ...a,
      volume: { ...a.volume, music: 20 },
      last: null,
      completed: { "svde/sdof-oscillator": a.completed["svde/sdof-oscillator"] }, // one lesson un-completed
      notes: { "svde/sdof-oscillator": "edited" }, // one note deleted, one edited
      cards: { ...a.cards, "svde/New term": { box: 1, due: 5 } },
      streams: [a.streams[1], a.streams[0]], // reordered
      pins: {},
    };
    const changes = diffState(a, b);
    // Not a rewrite: the untouched enrollment, quiz result and bookmark produce no statements.
    expect(changes.some((s) => /enrollments|quiz_results|bookmarks/.test(s.sql))).toBe(false);

    apply(db, changes);
    expect(read(db)).toEqual(b);
    db.close();
  });

  it("produces no statements when nothing changed", () => {
    expect(diffState(sample(), sample())).toEqual([]);
  });

  it("restores a clean slate when everything is removed (reset)", () => {
    const db = freshDb();
    apply(db, diffState(initialState(), sample()));
    apply(db, diffState(sample(), initialState()));
    expect(read(db)).toEqual(initialState());
    db.close();
  });
});
