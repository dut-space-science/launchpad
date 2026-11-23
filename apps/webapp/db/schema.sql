-- Launchpad content database. Source of truth for everything a learner reads.
-- Built into public/content.sqlite by `pnpm run build:db` (schema.sql, then seed/*.sql in name order).
-- Learner progress lives in a different database (see src/store/db). Nothing here is ever written by the app.
-- Text fields support **bold**, *italic* and $LaTeX$ where the app renders them as rich text.

PRAGMA foreign_keys = ON;

-- Knowledge tree ------------------------------------------------------------------------------------------
CREATE TABLE fields (
  id        TEXT PRIMARY KEY,
  code      TEXT NOT NULL,
  name      TEXT NOT NULL,
  summary   TEXT NOT NULL,
  position  INTEGER NOT NULL
);

CREATE TABLE disciplines (
  id        TEXT PRIMARY KEY,
  field_id  TEXT NOT NULL REFERENCES fields(id),
  code      TEXT NOT NULL,
  name      TEXT NOT NULL,
  level     TEXT NOT NULL CHECK (level IN ('Foundation', 'Intermediate', 'Advanced')),
  position  INTEGER NOT NULL
);

CREATE TABLE discipline_topics (
  discipline_id TEXT NOT NULL REFERENCES disciplines(id),
  position      INTEGER NOT NULL,
  topic         TEXT NOT NULL,
  PRIMARY KEY (discipline_id, position)
);

-- Courses -------------------------------------------------------------------------------------------------
CREATE TABLE courses (
  slug            TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  subtitle        TEXT NOT NULL,
  description     TEXT NOT NULL,
  discipline_id   TEXT NOT NULL REFERENCES disciplines(id),
  level           TEXT NOT NULL CHECK (level IN ('Foundation', 'Intermediate', 'Advanced')),
  instructor_name TEXT NOT NULL,
  instructor_role TEXT NOT NULL,
  updated         TEXT NOT NULL,
  hue             INTEGER NOT NULL,
  position        INTEGER NOT NULL
);

CREATE TABLE course_also_disciplines (
  course_slug   TEXT NOT NULL REFERENCES courses(slug),
  discipline_id TEXT NOT NULL REFERENCES disciplines(id),
  position      INTEGER NOT NULL,
  PRIMARY KEY (course_slug, discipline_id)
);

-- kind: outcome | prerequisite | audience
CREATE TABLE course_points (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  kind        TEXT NOT NULL CHECK (kind IN ('outcome', 'prerequisite', 'audience')),
  position    INTEGER NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (course_slug, kind, position)
);

CREATE TABLE modules (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  id          TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (course_slug, id)
);

CREATE TABLE lessons (
  course_slug TEXT NOT NULL,
  id          TEXT NOT NULL,
  module_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  minutes     INTEGER NOT NULL,
  summary     TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (course_slug, id),
  FOREIGN KEY (course_slug, module_id) REFERENCES modules(course_slug, id)
);

CREATE TABLE lesson_videos (
  course_slug TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  youtube_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  channel     TEXT NOT NULL,
  start       INTEGER,
  PRIMARY KEY (course_slug, lesson_id, position),
  FOREIGN KEY (course_slug, lesson_id) REFERENCES lessons(course_slug, id)
);

-- One row per block of lesson text. kind: h | p | ul | ol | eq | callout | table | lab.
-- data is the JSON of the block's fields (text, items, name, caption, head, rows, id ...).
CREATE TABLE lesson_blocks (
  course_slug TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('h', 'p', 'ul', 'ol', 'eq', 'callout', 'table', 'lab')),
  data        TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (course_slug, lesson_id, position),
  FOREIGN KEY (course_slug, lesson_id) REFERENCES lessons(course_slug, id)
);

CREATE TABLE lesson_takeaways (
  course_slug TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (course_slug, lesson_id, position),
  FOREIGN KEY (course_slug, lesson_id) REFERENCES lessons(course_slug, id)
);

CREATE TABLE lesson_refs (
  course_slug TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  org         TEXT NOT NULL,
  url         TEXT,
  note        TEXT,
  PRIMARY KEY (course_slug, lesson_id, position),
  FOREIGN KEY (course_slug, lesson_id) REFERENCES lessons(course_slug, id)
);

-- Module quiz. options is a JSON array of strings; answer is the index of the correct one.
CREATE TABLE quiz_questions (
  course_slug TEXT NOT NULL,
  module_id   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  question    TEXT NOT NULL,
  options     TEXT NOT NULL CHECK (json_valid(options)),
  answer      INTEGER NOT NULL,
  why         TEXT NOT NULL,
  PRIMARY KEY (course_slug, module_id, position),
  FOREIGN KEY (course_slug, module_id) REFERENCES modules(course_slug, id)
);

-- Reference material ------------------------------------------------------------------------------------------
CREATE TABLE glossary_terms (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  position    INTEGER NOT NULL,
  term        TEXT NOT NULL,
  unit        TEXT,
  def         TEXT NOT NULL,
  PRIMARY KEY (course_slug, position)
);

CREATE TABLE library_refs (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  org         TEXT NOT NULL,
  url         TEXT,
  note        TEXT,
  PRIMARY KEY (course_slug, position)
);

CREATE TABLE databank_facts (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  id          TEXT NOT NULL,
  unit        TEXT NOT NULL,
  title       TEXT NOT NULL,
  text        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (course_slug, id)
);

CREATE TABLE databank_code (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  id          TEXT NOT NULL,
  unit        TEXT NOT NULL,
  title       TEXT NOT NULL,
  lang        TEXT NOT NULL CHECK (lang IN ('python')),
  code        TEXT NOT NULL,
  note        TEXT,
  position    INTEGER NOT NULL,
  PRIMARY KEY (course_slug, id)
);

-- Practice ------------------------------------------------------------------------------------------------------
CREATE TABLE practice_packs (
  course_slug TEXT NOT NULL REFERENCES courses(slug),
  id          TEXT NOT NULL,
  unit        TEXT NOT NULL,
  title       TEXT NOT NULL,
  blurb       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('concept', 'problems', 'mixed')),
  position    INTEGER NOT NULL,
  PRIMARY KEY (course_slug, id)
);

-- kind: mcq | numeric | written. options is a JSON array (mcq); answer is the correct option index (mcq);
-- numeric_tolerance is relative (0.02 = 2%).
CREATE TABLE practice_problems (
  course_slug       TEXT NOT NULL,
  pack_id           TEXT NOT NULL,
  id                TEXT NOT NULL,
  position          INTEGER NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('mcq', 'numeric', 'written')),
  difficulty        INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  prompt            TEXT NOT NULL,
  hint              TEXT,
  solution          TEXT NOT NULL,
  options           TEXT CHECK (options IS NULL OR json_valid(options)),
  answer            INTEGER,
  numeric_value     REAL,
  numeric_tolerance REAL,
  numeric_unit      TEXT,
  PRIMARY KEY (course_slug, pack_id, id),
  FOREIGN KEY (course_slug, pack_id) REFERENCES practice_packs(course_slug, id)
);
