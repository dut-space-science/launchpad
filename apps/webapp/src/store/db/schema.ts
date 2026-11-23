import contentSchema from "../../../db/schema.sql?raw";

/** The course-content tables, as SQL. Uploaded .sql course files run on top of this. */
export const CONTENT_SCHEMA_SQL: string = contentSchema;

/**
 * SQLite schema for the browser database: the learner's data (one table per concept, not a JSON blob) and the
 * installed course content (db/schema.sql, the same tables that ship in content.sqlite), so it can be opened
 * and queried with any SQLite tool, and so wiping the database really does empty everything. One table per concept (not a JSON blob) so the data can be opened
 * and queried with any SQLite tool. Bump SCHEMA_VERSION and add a step to MIGRATIONS to change it later.
 */
export const SCHEMA_VERSION = 2;

/** Steps run in order for databases whose PRAGMA user_version is lower than the step's version. */
export const MIGRATIONS: { version: number; sql: string[] }[] = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      // Single values: profile.name, last (JSON), volume.music, volume.lessons, focusMode.
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS enrollments (course TEXT PRIMARY KEY, enrolled_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS lesson_progress (
         course TEXT NOT NULL, lesson TEXT NOT NULL, completed_at INTEGER NOT NULL,
         PRIMARY KEY (course, lesson)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS quiz_results (
         course TEXT NOT NULL, module TEXT NOT NULL, best REAL NOT NULL, last REAL NOT NULL,
         attempts INTEGER NOT NULL, passed INTEGER NOT NULL, at INTEGER NOT NULL,
         PRIMARY KEY (course, module)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS notes (
         course TEXT NOT NULL, lesson TEXT NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL,
         PRIMARY KEY (course, lesson)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS bookmarks (
         course TEXT NOT NULL, lesson TEXT NOT NULL, created_at INTEGER NOT NULL,
         PRIMARY KEY (course, lesson)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS databank_pins (
         course TEXT NOT NULL, item TEXT NOT NULL, created_at INTEGER NOT NULL,
         PRIMARY KEY (course, item)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS flashcards (
         course TEXT NOT NULL, term TEXT NOT NULL, box INTEGER NOT NULL, due INTEGER NOT NULL,
         PRIMARY KEY (course, term)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS practice_results (
         course TEXT NOT NULL, pack TEXT NOT NULL, best REAL NOT NULL, last REAL NOT NULL,
         attempts INTEGER NOT NULL, at INTEGER NOT NULL,
         PRIMARY KEY (course, pack)) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS activity (day TEXT PRIMARY KEY, actions INTEGER NOT NULL) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS focus_minutes (day TEXT PRIMARY KEY, minutes INTEGER NOT NULL) WITHOUT ROWID`,
      `CREATE TABLE IF NOT EXISTS music_streams (
         id TEXT PRIMARY KEY, label TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, position INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS lab_state (id TEXT PRIMARY KEY, json TEXT NOT NULL)`,
    ],
  },
  // Version 2: the course content lives in the browser database too (installed from the shipped content.sqlite).
  { version: 2, sql: [contentSchema] },
];

/** Every table that holds learner data, in the order they are read back. */
export const DATA_TABLES = [
  "settings",
  "enrollments",
  "lesson_progress",
  "quiz_results",
  "notes",
  "bookmarks",
  "databank_pins",
  "flashcards",
  "practice_results",
  "activity",
  "focus_minutes",
  "music_streams",
  "lab_state",
] as const;
export type DataTable = (typeof DATA_TABLES)[number];
