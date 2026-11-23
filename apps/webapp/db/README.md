# Course database

Everything a learner reads (courses, lessons, quizzes, glossary, databank, practice problems and the knowledge tree)
lives here as SQL, not in the JavaScript.

- `schema.sql` defines the tables.
- `seed/*.sql` fills them, applied in file-name order. `00-taxonomy.sql` is the knowledge tree; each course is its own
  file (`10-course-<slug>.sql`).
- `public/content.sqlite` is built from those files (by the Vite plugin on `dev` and `build`, or `pnpm run build:db`)
  and shipped with the app. On first launch (and whenever the shipped file changes) the browser copies it into its own
  SQLite database, next to the learner's data, and renders from that copy. Settings > Wipe all data empties that
  database, content included, and the app stays blank until "Install course content" is chosen.
  The shipped file is generated: edit the SQL, not the binary.

To add a course, copy an existing course seed, give it the next number (`20-course-...sql`), change the data and set
`position` after the existing courses. Lessons embed interactive labs with a `lab` block whose `id` matches a lab in
`src/labs`. The browser database's schema is `schema.sql` plus the learner tables in `src/store/db/schema.ts`.

## Using your own courses

On first run (and after Settings > Wipe all data) the app asks where its courses come from. "My own courses" accepts
either a SQLite database or a `.sql` file. Both must follow `schema.sql` (the app serves a copy as
`content-schema.sql`, linked from the setup screen). A `.sql` file is run on top of the empty schema, so it only needs
`INSERT` statements; see `seed/` for examples. The file is fully checked (schema, foreign keys, at least one course)
before anything is stored.
