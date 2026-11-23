import type {
  Block,
  CodeSnippet,
  Course,
  Fact,
  GlossaryTerm,
  Lesson,
  Module,
  Pack,
  Problem,
  Question,
  Reference,
  Video,
} from "@/data/types";
import type { Field } from "@/data/taxonomy";

/** Tables of the content database (db/schema.sql), read whole at start-up. */
export const CONTENT_TABLES = [
  "fields",
  "disciplines",
  "discipline_topics",
  "courses",
  "course_also_disciplines",
  "course_points",
  "modules",
  "lessons",
  "lesson_videos",
  "lesson_blocks",
  "lesson_takeaways",
  "lesson_refs",
  "quiz_questions",
  "glossary_terms",
  "library_refs",
  "databank_facts",
  "databank_code",
  "practice_packs",
  "practice_problems",
] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];
export type ContentRows = Record<ContentTable, Record<string, unknown>[]>;

/** A parameterised SQL statement (same shape as the learner database's writes). */
export interface ContentStatement {
  sql: string;
  bind: (string | number | null)[];
}

/**
 * Everything needed to replace the installed content in the browser database with `rows`, atomically: delete the old
 * content, insert the new, and record the version. Run in one transaction (foreign keys are checked at its end).
 */
export function installStatements(
  rows: ContentRows,
  version: string,
  source: "default" | "custom" = "default",
): ContentStatement[] {
  const out: ContentStatement[] = [
    { sql: "PRAGMA defer_foreign_keys = ON", bind: [] },
    ...CONTENT_TABLES.map((t) => ({ sql: `DELETE FROM ${t}`, bind: [] })),
  ];
  for (const t of CONTENT_TABLES)
    for (const r of rows[t]) {
      const cols = Object.keys(r);
      out.push({
        sql: `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        bind: cols.map((c) => r[c] as string | number | null),
      });
    }
  out.push(metaStatement("content_version", version), metaStatement("content_source", source));
  return out;
}

export const metaStatement = (key: string, value: string): ContentStatement => ({
  sql: `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  bind: [key, value],
});

export interface Content {
  fields: Field[];
  courses: Course[];
}

type R = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : String(v as number));
const opt = (v: unknown) => (v === null || v === undefined ? undefined : str(v));
const byPos = (a: R, b: R) => Number(a.position) - Number(b.position);
/** Rows grouped by a key, each group in position order. */
function group(rows: R[], key: (r: R) => string) {
  const m = new Map<string, R[]>();
  for (const r of [...rows].sort(byPos)) {
    const k = key(r);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return (k: string) => m.get(k) ?? [];
}
/** Copy only the properties that are set, so objects match their TypeScript shape exactly. */
function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

export function contentFromRows(rows: ContentRows): Content {
  // Knowledge tree
  const topicsOf = group(rows.discipline_topics, (r) => str(r.discipline_id));
  const disciplinesOf = group(rows.disciplines, (r) => str(r.field_id));
  const fields: Field[] = [...rows.fields].sort(byPos).map((f) => ({
    id: str(f.id),
    code: str(f.code),
    name: str(f.name),
    summary: str(f.summary),
    disciplines: disciplinesOf(str(f.id)).map((d) => ({
      id: str(d.id),
      code: str(d.code),
      name: str(d.name),
      level: d.level as Field["disciplines"][number]["level"],
      topics: topicsOf(str(d.id)).map((t) => str(t.topic)),
    })),
  }));

  // Courses
  const key2 = (a: string, b: string) => `${a}\u0000${b}`;
  const alsoOf = group(rows.course_also_disciplines, (r) => str(r.course_slug));
  const pointsOf = group(rows.course_points, (r) => key2(str(r.course_slug), str(r.kind)));
  const modulesOf = group(rows.modules, (r) => str(r.course_slug));
  const lessonsOf = group(rows.lessons, (r) => key2(str(r.course_slug), str(r.module_id)));
  const videosOf = group(rows.lesson_videos, (r) => key2(str(r.course_slug), str(r.lesson_id)));
  const blocksOf = group(rows.lesson_blocks, (r) => key2(str(r.course_slug), str(r.lesson_id)));
  const takeawaysOf = group(rows.lesson_takeaways, (r) =>
    key2(str(r.course_slug), str(r.lesson_id)),
  );
  const refsOf = group(rows.lesson_refs, (r) => key2(str(r.course_slug), str(r.lesson_id)));
  const quizOf = group(rows.quiz_questions, (r) => key2(str(r.course_slug), str(r.module_id)));
  const glossaryOf = group(rows.glossary_terms, (r) => str(r.course_slug));
  const libraryOf = group(rows.library_refs, (r) => str(r.course_slug));
  const factsOf = group(rows.databank_facts, (r) => str(r.course_slug));
  const codeOf = group(rows.databank_code, (r) => str(r.course_slug));
  const packsOf = group(rows.practice_packs, (r) => str(r.course_slug));
  const problemsOf = group(rows.practice_problems, (r) => key2(str(r.course_slug), str(r.pack_id)));

  const reference = (r: R): Reference =>
    clean({ title: str(r.title), org: str(r.org), url: opt(r.url), note: opt(r.note) });

  const courses: Course[] = [...rows.courses].sort(byPos).map((c) => {
    const slug = str(c.slug);
    const points = (kind: string) => pointsOf(key2(slug, kind)).map((p) => str(p.text));
    const also = alsoOf(slug).map((a) => str(a.discipline_id));

    const modules: Module[] = modulesOf(slug).map((m) => ({
      id: str(m.id),
      title: str(m.title),
      summary: str(m.summary),
      lessons: lessonsOf(key2(slug, str(m.id))).map((l): Lesson => {
        const k = key2(slug, str(l.id));
        const videos = videosOf(k).map((v): Video =>
          clean({
            id: str(v.youtube_id),
            title: str(v.title),
            channel: str(v.channel),
            start: v.start === null ? undefined : Number(v.start),
          }),
        );
        const refs = refsOf(k).map(reference);
        return clean({
          id: str(l.id),
          title: str(l.title),
          minutes: Number(l.minutes),
          summary: str(l.summary),
          videos: videos.length ? videos : undefined,
          blocks: blocksOf(k).map(
            (b) => ({ t: str(b.kind), ...(JSON.parse(str(b.data)) as object) }) as Block,
          ),
          takeaways: takeawaysOf(k).map((t) => str(t.text)),
          refs: refs.length ? refs : undefined,
        });
      }),
      quiz: quizOf(key2(slug, str(m.id))).map((q): Question => ({
        q: str(q.question),
        options: JSON.parse(str(q.options)) as string[],
        answer: Number(q.answer),
        why: str(q.why),
      })),
    }));

    const facts = factsOf(slug).map((f): Fact => ({
      id: str(f.id),
      unit: str(f.unit),
      title: str(f.title),
      text: str(f.text),
    }));
    const code = codeOf(slug).map((k): CodeSnippet =>
      clean({
        id: str(k.id),
        unit: str(k.unit),
        title: str(k.title),
        lang: k.lang as "python",
        code: str(k.code),
        note: opt(k.note),
      }),
    );
    const packs = packsOf(slug).map((p): Pack => ({
      id: str(p.id),
      unit: str(p.unit),
      title: str(p.title),
      blurb: str(p.blurb),
      kind: p.kind as Pack["kind"],
      problems: problemsOf(key2(slug, str(p.id))).map((r): Problem =>
        clean({
          id: str(r.id),
          kind: r.kind as Problem["kind"],
          prompt: str(r.prompt),
          difficulty: Number(r.difficulty) as Problem["difficulty"],
          hint: opt(r.hint),
          solution: str(r.solution),
          options: r.options === null ? undefined : (JSON.parse(str(r.options)) as string[]),
          answer: r.answer === null ? undefined : Number(r.answer),
          numeric:
            r.numeric_value === null
              ? undefined
              : {
                  value: Number(r.numeric_value),
                  tolerance: Number(r.numeric_tolerance),
                  unit: str(r.numeric_unit),
                },
        }),
      ),
    }));

    return clean({
      slug,
      title: str(c.title),
      subtitle: str(c.subtitle),
      description: str(c.description),
      discipline: str(c.discipline_id),
      alsoDisciplines: also.length ? also : undefined,
      level: c.level as Course["level"],
      instructor: { name: str(c.instructor_name), role: str(c.instructor_role) },
      updated: str(c.updated),
      outcomes: points("outcome"),
      prerequisites: points("prerequisite"),
      audience: points("audience"),
      hue: Number(c.hue),
      modules,
      glossary: glossaryOf(slug).map((g): GlossaryTerm =>
        clean({ term: str(g.term), unit: opt(g.unit), def: str(g.def) }),
      ),
      library: libraryOf(slug).map(reference),
      databank: facts.length || code.length ? { facts, code } : undefined,
      practice: packs.length ? packs : undefined,
    });
  });

  return { fields, courses };
}
