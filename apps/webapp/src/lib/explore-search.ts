import type { Block, Course, Lesson, Module } from "@/data/types";
import { courses } from "@/data/courses";
import { allDisciplines, disciplineById, type DisciplineEntry } from "@/data/taxonomy";
import { createSearch, type SearchField, type SearchOutcome, type Searcher } from "@/lib/search";

/** Join pieces of text as sentences, adding a full stop only where one is missing. */
const sentences = (parts: string[]) =>
  parts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (/[.!?:]$/.test(t) ? t : `${t}.`))
    .join(" ");

/** Everything a learner can read in a lesson's body, as plain text (labs are interactive, so they add nothing). */
export function blockText(b: Block): string {
  switch (b.t) {
    case "h":
    case "p":
      return b.text;
    case "ul":
    case "ol":
      return sentences(b.items);
    case "eq":
      return `${b.name ?? ""} ${b.caption ?? ""} ${b.text}`;
    case "callout":
      return `${b.title ?? ""} ${b.text}`;
    case "table":
      return sentences([b.head, ...b.rows].map((r) => r.join(", ")));
    default:
      return "";
  }
}
export const lessonBody = (l: Lesson) => sentences(l.blocks.map(blockText));

// --- Courses ------------------------------------------------------------------------------------------------------

export type CourseDoc = { slug: string; title: string; available: boolean };

/** A course is found by its own description and, with less weight, by what its lessons teach. */
function courseFields(c: Course): SearchField[] {
  const d = disciplineById(c.discipline);
  const lessons = c.modules.flatMap((m) => m.lessons);
  return [
    { text: c.title, weight: 6 },
    { text: c.subtitle, weight: 3 },
    { text: d?.name ?? "", weight: 3 },
    { text: c.description, weight: 2 },
    { text: d?.topics.join(". ") ?? "", weight: 2 },
    { text: c.modules.map((m) => m.title).join(". "), weight: 2 },
    { text: lessons.map((l) => l.title).join(". "), weight: 2 },
    { text: c.outcomes.join(". "), weight: 1.5 },
    { text: d?.field.name ?? "", weight: 1.5 },
    { text: lessons.map((l) => `${l.summary} ${l.takeaways.join(" ")}`).join(" "), weight: 1 },
    {
      text: lessons
        .flatMap((l) => l.videos ?? [])
        .map((v) => v.channel)
        .join(" "),
      weight: 1,
    },
    {
      text: lessons
        .flatMap((l) => l.videos ?? [])
        .map((v) => v.title)
        .join(". "),
      weight: 0.75,
    },
    {
      text: [
        ...c.glossary.map((g) => `${g.term} ${g.def}`),
        ...(c.databank?.facts ?? []).map((f) => `${f.title} ${f.text}`),
        ...(c.databank?.code ?? []).map((k) => k.title),
      ].join(" "),
      weight: 0.75,
    },
    { text: c.level, weight: 1 },
    { text: lessons.map(lessonBody).join(" "), weight: 0.5 },
  ];
}
function plannedCourseFields(d: DisciplineEntry): SearchField[] {
  return [
    { text: d.name, weight: 6 },
    { text: d.topics.join(". "), weight: 3 },
    { text: d.field.name, weight: 1.5 },
    { text: d.level, weight: 1 },
  ];
}

let courseIndex: Searcher<CourseDoc> | undefined;
function courseSearcher() {
  courseIndex ??= createSearch<CourseDoc>(
    [
      ...courses.map((c) => ({ slug: c.slug, title: c.title, available: true })),
      ...allDisciplines.map((d) => ({ slug: d.id, title: d.name, available: false })),
    ],
    (doc) => {
      if (doc.available) return courseFields(courses.find((c) => c.slug === doc.slug)!);
      return plannedCourseFields(allDisciplines.find((d) => d.id === doc.slug)!);
    },
  );
  return courseIndex;
}

let lastCourseQuery: { q: string; out: { scores: Map<string, number>; partial: boolean } | null } =
  {
    q: "\u0000",
    out: null,
  };
/**
 * Relevance of every course and planned course for a query, keyed by slug (a planned course's slug is its
 * discipline id). Returns null when the query has nothing to search for, which means "no text filter".
 */
export function courseScores(q: string) {
  if (lastCourseQuery.q === q) return lastCourseQuery.out;
  const r = courseSearcher().search(q);
  const out = r.empty
    ? null
    : { scores: new Map(r.results.map((x) => [x.item.slug, x.score])), partial: r.partial };
  lastCourseQuery = { q, out };
  return out;
}

// --- Topics (lessons) ---------------------------------------------------------------------------------------------

export type LessonDoc = { course: Course; unit: Module; unitIndex: number; lesson: Lesson };

let lessonIndex: Searcher<LessonDoc> | undefined;
function lessonSearcher() {
  lessonIndex ??= createSearch<LessonDoc>(
    courses.flatMap((course) =>
      course.modules.flatMap((unit, unitIndex) =>
        unit.lessons.map((lesson) => ({ course, unit, unitIndex, lesson })),
      ),
    ),
    ({ course, unit, lesson }) => [
      { text: lesson.title, weight: 6 },
      { text: lesson.summary, weight: 3 },
      { text: lesson.takeaways.join(". "), weight: 2 },
      { text: unit.title, weight: 1.5 },
      { text: lessonBody(lesson), weight: 1, snippet: true },
      {
        text: (lesson.videos ?? []).map((v) => `${v.title} ${v.channel}`).join(". "),
        weight: 0.75,
      },
      { text: course.title, weight: 0.5 },
    ],
  );
  return lessonIndex;
}

export function searchLessons(q: string): SearchOutcome<LessonDoc> {
  return lessonSearcher().search(q);
}

// --- Planned topics ------------------------------------------------------------------------------------------------

export type PlannedDoc = { discipline: DisciplineEntry; topic: string };

let plannedIndex: Searcher<PlannedDoc> | undefined;
export function searchPlanned(q: string): SearchOutcome<PlannedDoc> {
  plannedIndex ??= createSearch<PlannedDoc>(
    allDisciplines.flatMap((discipline) =>
      discipline.topics.map((topic) => ({ discipline, topic })),
    ),
    ({ discipline, topic }) => [
      { text: topic, weight: 6 },
      { text: discipline.name, weight: 2 },
      { text: discipline.field.name, weight: 1 },
    ],
  );
  return plannedIndex.search(q);
}
