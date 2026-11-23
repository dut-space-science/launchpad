import type { Course } from "../types";

/**
 * Course registry, filled at start-up from the content database (see src/content/load.ts).
 * To add a course, add a seed file to db/seed (see db/README.md); routes, search, progress, certificates,
 * flashcards and the glossary pick it up automatically.
 */
export let courses: Course[] = [];
export function setCourses(next: Course[]) {
  courses = next;
}

export const getCourse = (slug?: string) => courses.find((c) => c.slug === slug);

export const lessonsOf = (c: Course) => c.modules.flatMap((m) => m.lessons);
export const lessonCount = (c: Course) => lessonsOf(c).length;
export const courseMinutes = (c: Course) => lessonsOf(c).reduce((s, l) => s + l.minutes, 0);

export function findLesson(c: Course, lessonId?: string) {
  for (const m of c.modules) {
    const i = m.lessons.findIndex((l) => l.id === lessonId);
    if (i >= 0) return { module: m, lesson: m.lessons[i] };
  }
  return undefined;
}

export const QUIZ_PASS = 0.7;

/** Ids of the interactive labs used by a unit's lessons, in order of first use. */
export const unitLabs = (m: { lessons: { blocks: { t: string; id?: string }[] }[] }) => [
  ...new Set(
    m.lessons.flatMap((l) => l.blocks.flatMap((b) => (b.t === "lab" && b.id ? [b.id] : []))),
  ),
];
