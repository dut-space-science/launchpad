import { initialState, type State } from "@/store/state";
import type { Stream } from "@/lib/youtube";
import type { DataTable } from "./schema";

/** A parameterised SQL statement. Values are bound, never concatenated into the SQL. */
export interface Statement {
  sql: string;
  bind: (string | number | null)[];
}
export type Rows = Partial<Record<DataTable, Record<string, unknown>[]>>;

/** Keys like "course/lesson" are split on the FIRST slash (course slugs never contain one; lesson/term ids may). */
const split = (k: string): [string, string] => {
  const i = k.indexOf("/");
  return [k.slice(0, i), k.slice(i + 1)];
};
const join = (a: unknown, b: unknown) => `${String(a)}/${String(b)}`;

/** Equal by value (entries are small plain records), so a restore of unchanged data writes nothing. */
const same = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

function mapDiff<T>(
  prev: Record<string, T>,
  next: Record<string, T>,
  upsert: (k: string, v: T) => Statement,
  remove: (k: string) => Statement,
) {
  const out: Statement[] = [];
  for (const k of Object.keys(next)) if (!same(prev[k], next[k])) out.push(upsert(k, next[k]));
  for (const k of Object.keys(prev)) if (!(k in next)) out.push(remove(k));
  return out;
}

const setting = (key: string, value: unknown): Statement => ({
  sql: `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  bind: [key, JSON.stringify(value)],
});
const unsetting = (key: string): Statement => ({
  sql: `DELETE FROM settings WHERE key = ?`,
  bind: [key],
});

/** The statements that turn the stored state `prev` into `next`. Only what changed is written. */
export function diffState(prev: State, next: State, now = Date.now()): Statement[] {
  const out: Statement[] = [];

  if (prev.profile.name !== next.profile.name) out.push(setting("profile.name", next.profile.name));
  if (JSON.stringify(prev.last) !== JSON.stringify(next.last))
    out.push(next.last ? setting("last", next.last) : unsetting("last"));
  if (prev.volume.music !== next.volume.music) out.push(setting("volume.music", next.volume.music));
  if (prev.volume.lessons !== next.volume.lessons)
    out.push(setting("volume.lessons", next.volume.lessons));
  if (prev.focusMode !== next.focusMode) out.push(setting("focusMode", next.focusMode));

  out.push(
    ...mapDiff(
      prev.enrolled,
      next.enrolled,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO enrollments (course, enrolled_at) VALUES (?, ?)`,
        bind: [k, v],
      }),
      (k) => ({ sql: `DELETE FROM enrollments WHERE course = ?`, bind: [k] }),
    ),
    ...mapDiff(
      prev.completed,
      next.completed,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO lesson_progress (course, lesson, completed_at) VALUES (?, ?, ?)`,
        bind: [...split(k), v],
      }),
      (k) => ({
        sql: `DELETE FROM lesson_progress WHERE course = ? AND lesson = ?`,
        bind: split(k),
      }),
    ),
    ...mapDiff(
      prev.quizzes,
      next.quizzes,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO quiz_results (course, module, best, last, attempts, passed, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        bind: [...split(k), v.best, v.last, v.attempts, v.passed ? 1 : 0, v.at],
      }),
      (k) => ({ sql: `DELETE FROM quiz_results WHERE course = ? AND module = ?`, bind: split(k) }),
    ),
    ...mapDiff(
      prev.notes,
      next.notes,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO notes (course, lesson, body, updated_at) VALUES (?, ?, ?, ?)`,
        bind: [...split(k), v, now],
      }),
      (k) => ({ sql: `DELETE FROM notes WHERE course = ? AND lesson = ?`, bind: split(k) }),
    ),
    ...mapDiff(
      prev.bookmarks,
      next.bookmarks,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO bookmarks (course, lesson, created_at) VALUES (?, ?, ?)`,
        bind: [...split(k), v],
      }),
      (k) => ({ sql: `DELETE FROM bookmarks WHERE course = ? AND lesson = ?`, bind: split(k) }),
    ),
    ...mapDiff(
      prev.pins,
      next.pins,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO databank_pins (course, item, created_at) VALUES (?, ?, ?)`,
        bind: [...split(k), v],
      }),
      (k) => ({ sql: `DELETE FROM databank_pins WHERE course = ? AND item = ?`, bind: split(k) }),
    ),
    ...mapDiff(
      prev.cards,
      next.cards,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO flashcards (course, term, box, due) VALUES (?, ?, ?, ?)`,
        bind: [...split(k), v.box, v.due],
      }),
      (k) => ({ sql: `DELETE FROM flashcards WHERE course = ? AND term = ?`, bind: split(k) }),
    ),
    ...mapDiff(
      prev.practice,
      next.practice,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO practice_results (course, pack, best, last, attempts, at) VALUES (?, ?, ?, ?, ?, ?)`,
        bind: [...split(k), v.best, v.last, v.attempts, v.at],
      }),
      (k) => ({
        sql: `DELETE FROM practice_results WHERE course = ? AND pack = ?`,
        bind: split(k),
      }),
    ),
    ...mapDiff(
      prev.activity,
      next.activity,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO activity (day, actions) VALUES (?, ?)`,
        bind: [k, v],
      }),
      (k) => ({ sql: `DELETE FROM activity WHERE day = ?`, bind: [k] }),
    ),
    ...mapDiff(
      prev.focus,
      next.focus,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO focus_minutes (day, minutes) VALUES (?, ?)`,
        bind: [k, v],
      }),
      (k) => ({ sql: `DELETE FROM focus_minutes WHERE day = ?`, bind: [k] }),
    ),
    ...mapDiff(
      prev.labState,
      next.labState,
      (k, v) => ({
        sql: `INSERT OR REPLACE INTO lab_state (id, json) VALUES (?, ?)`,
        bind: [k, JSON.stringify(v)],
      }),
      (k) => ({ sql: `DELETE FROM lab_state WHERE id = ?`, bind: [k] }),
    ),
  );

  // The music list is tiny and ordered, so rewrite it whole when anything about it changes.
  if (JSON.stringify(prev.streams) !== JSON.stringify(next.streams)) {
    out.push({ sql: `DELETE FROM music_streams`, bind: [] });
    next.streams.forEach((s, i) =>
      out.push({
        sql: `INSERT INTO music_streams (id, label, kind, ref, position) VALUES (?, ?, ?, ?, ?)`,
        bind: [s.id, s.label, s.kind, s.ref, i],
      }),
    );
  }
  return out;
}

/** Rebuild the in-memory state from rows read out of the database. */
export function stateFromRows(rows: Rows): State {
  const s = initialState();
  const list = (t: DataTable) => rows[t] ?? [];
  for (const r of list("settings")) {
    let v: unknown;
    try {
      v = JSON.parse(String(r.value));
    } catch {
      continue;
    }
    if (r.key === "profile.name") s.profile = { name: String(v) };
    else if (r.key === "last") s.last = v as State["last"];
    else if (r.key === "volume.music") s.volume.music = Number(v);
    else if (r.key === "volume.lessons") s.volume.lessons = Number(v);
    else if (r.key === "focusMode") s.focusMode = !!v;
  }
  for (const r of list("enrollments")) s.enrolled[String(r.course)] = Number(r.enrolled_at);
  for (const r of list("lesson_progress"))
    s.completed[join(r.course, r.lesson)] = Number(r.completed_at);
  for (const r of list("quiz_results"))
    s.quizzes[join(r.course, r.module)] = {
      best: Number(r.best),
      last: Number(r.last),
      attempts: Number(r.attempts),
      passed: !!r.passed,
      at: Number(r.at),
    };
  for (const r of list("notes")) s.notes[join(r.course, r.lesson)] = String(r.body);
  for (const r of list("bookmarks")) s.bookmarks[join(r.course, r.lesson)] = Number(r.created_at);
  for (const r of list("databank_pins")) s.pins[join(r.course, r.item)] = Number(r.created_at);
  for (const r of list("flashcards"))
    s.cards[join(r.course, r.term)] = { box: Number(r.box), due: Number(r.due) };
  for (const r of list("practice_results"))
    s.practice[join(r.course, r.pack)] = {
      best: Number(r.best),
      last: Number(r.last),
      attempts: Number(r.attempts),
      at: Number(r.at),
    };
  for (const r of list("activity")) s.activity[String(r.day)] = Number(r.actions);
  for (const r of list("focus_minutes")) s.focus[String(r.day)] = Number(r.minutes);
  for (const r of list("lab_state")) {
    try {
      s.labState[String(r.id)] = JSON.parse(String(r.json));
    } catch {
      /* skip a corrupt snapshot */
    }
  }
  s.streams = list("music_streams")
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((r): Stream => ({
      id: String(r.id),
      label: String(r.label),
      kind: r.kind as Stream["kind"],
      ref: String(r.ref),
    }));
  return s;
}
