import type { Course } from "@/data/types";
import { courseMinutes, courses, lessonCount, lessonsOf, unitLabs } from "@/data/courses";
import { upcomingCourses, type UpcomingCourse } from "@/data/courses/upcoming";
import { disciplineById, fieldOfDiscipline } from "@/data/taxonomy";
import { courseScores } from "@/lib/explore-search";

export type Entry =
  | { kind: "course"; course: Course }
  | { kind: "upcoming"; course: UpcomingCourse };

/** Disciplines that already have a real course; their planned placeholders are hidden. */
const covered = new Set(courses.flatMap((c) => [c.discipline, ...(c.alsoDisciplines ?? [])]));

export const entries: Entry[] = [
  ...courses.map((course) => ({ kind: "course", course }) as Entry),
  ...upcomingCourses()
    .filter((u) => !covered.has(u.discipline))
    .map((course) => ({ kind: "upcoming", course }) as Entry),
];

export const disciplinesOf = (e: Entry) =>
  e.kind === "course"
    ? [e.course.discipline, ...(e.course.alsoDisciplines ?? [])]
    : [e.course.discipline];
export const fieldsOf = (e: Entry) => [
  ...new Set(
    disciplinesOf(e)
      .map((d) => fieldOfDiscipline(d)?.id)
      .filter((x): x is string => !!x),
  ),
];
/** The course's primary field and discipline, for badges. */
export const primary = (e: Entry) => {
  const d = disciplineById(e.course.discipline);
  return { discipline: d, field: d?.field };
};

export type FacetKey = "field" | "disc" | "lvl" | "inst" | "dur" | "feat" | "prog" | "avail";
export type Filters = { q: string } & Record<FacetKey, string[]>;

/**
 * The institution a lesson's material comes from, read from its video's channel label: "MIT OpenCourseWare",
 * "NPTEL, IIT Madras (Prof. ...)", "NPTEL, IISc Bangalore", "IIT Roorkee". Channels that name none give undefined.
 */
export function institutionOfChannel(channel: string): string | undefined {
  if (/^MIT\b/i.test(channel)) return "MIT";
  const m = /\b(IISc [A-Z][a-z]+|IIT [A-Z][a-z]+)/.exec(channel);
  return m?.[1];
}
export const INSTITUTION_LABEL: Record<string, string> = { MIT: "MIT OpenCourseWare" };
export const institutionLabel = (i: string) => INSTITUTION_LABEL[i] ?? i;

const instCache = new WeakMap<Course, string[]>();
/** Institutions whose material a course uses, in order of first appearance. */
export function courseInstitutions(course: Course): string[] {
  let out = instCache.get(course);
  if (!out) {
    out = [
      ...new Set(
        lessonsOf(course)
          .flatMap((l) => l.videos ?? [])
          .map((v) => institutionOfChannel(v.channel))
          .filter((x): x is string => !!x),
      ),
    ];
    instCache.set(course, out);
  }
  return out;
}
/** Every institution across the installed courses: MIT first, then the rest A to Z. */
export const INSTITUTIONS = [...new Set(courses.flatMap(courseInstitutions))]
  .sort((a, b) => (a === "MIT" ? -1 : b === "MIT" ? 1 : a.localeCompare(b)))
  .map((i) => ({ value: i, label: institutionLabel(i) }));

export const DURATIONS = [
  { value: "short", label: "Under 3 hours", test: (m: number) => m < 180 },
  { value: "medium", label: "3 to 8 hours", test: (m: number) => m >= 180 && m <= 480 },
  { value: "long", label: "Over 8 hours", test: (m: number) => m > 480 },
];
export const FEATURES = [
  { value: "video", label: "Video lessons" },
  { value: "labs", label: "Interactive labs" },
  { value: "quizzes", label: "Unit quizzes" },
];
export const PROGRESS = [
  { value: "new", label: "Not started" },
  { value: "progress", label: "In progress" },
  { value: "done", label: "Completed" },
];
export const AVAIL = [
  { value: "now", label: "Available now" },
  { value: "soon", label: "Coming soon" },
];
export const LEVELS = ["Foundation", "Intermediate", "Advanced"];
export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "az", label: "Title A to Z" },
  { value: "short", label: "Shortest first" },
  { value: "long", label: "Longest first" },
];

export function stats(course: Course) {
  const labs = new Set(course.modules.flatMap((m) => unitLabs(m)));
  return {
    lessons: lessonCount(course),
    minutes: courseMinutes(course),
    labs: labs.size,
    videos: lessonsOf(course).filter((l) => l.videos?.length).length,
    quizzes: course.modules.filter((m) => m.quiz.length).length,
  };
}

export type ProgressState = {
  completed: Record<string, number>;
  quizzes: Record<string, { passed: boolean }>;
  enrolled: Record<string, number>;
};

function progressOf(course: Course, s: ProgressState): "new" | "progress" | "done" {
  const done = lessonsOf(course).filter((l) => s.completed[`${course.slug}/${l.id}`]).length;
  const quizzes = course.modules.filter((m) => s.quizzes[`${course.slug}/${m.id}`]?.passed).length;
  if (done === lessonCount(course) && quizzes === course.modules.length) return "done";
  return done > 0 || quizzes > 0 || s.enrolled[course.slug] ? "progress" : "new";
}

/** Does an entry satisfy the filters? `ignore` leaves one facet out so its option counts can be computed. */
export function matches(e: Entry, f: Filters, s: ProgressState, ignore?: FacetKey) {
  const c = e.course;
  // Text search: ranked full-text over the course and its lessons (see lib/explore-search).
  const found = courseScores(f.q);
  if (found && !found.scores.has(c.slug)) return false;
  const on = (k: FacetKey) => k !== ignore && f[k].length > 0;
  // Field and discipline form one tree: a course matches if it is in a chosen field OR a chosen discipline.
  if (on("field") || on("disc")) {
    const byField = on("field") && fieldsOf(e).some((x) => f.field.includes(x));
    const byDisc = on("disc") && disciplinesOf(e).some((x) => f.disc.includes(x));
    if (!byField && !byDisc) return false;
  }
  if (on("lvl") && !f.lvl.includes(c.level)) return false;
  if (on("avail") && !f.avail.includes(e.kind === "course" ? "now" : "soon")) return false;
  if (on("inst")) {
    if (e.kind !== "course" || !courseInstitutions(e.course).some((i) => f.inst.includes(i)))
      return false;
  }
  // Facets below describe content we only have for available courses.
  if (on("dur") || on("feat") || on("prog")) {
    if (e.kind !== "course") return false;
    const st = stats(e.course);
    if (on("dur") && !DURATIONS.some((d) => f.dur.includes(d.value) && d.test(st.minutes)))
      return false;
    if (
      on("feat") &&
      !f.feat.every((x) =>
        x === "video" ? st.videos > 0 : x === "labs" ? st.labs > 0 : st.quizzes > 0,
      )
    )
      return false;
    if (on("prog") && !f.prog.includes(progressOf(e.course, s))) return false;
  }
  return true;
}

export function facetCount(facet: FacetKey, value: string, f: Filters, s: ProgressState) {
  // Choosing a field or a discipline replaces the other tree facet, so the count answers "if I pick this".
  const trial: Filters = {
    ...f,
    [facet]: [value],
    ...(facet === "field" ? { disc: [] } : facet === "disc" ? { field: [] } : {}),
  };
  return entries.filter((e) => matches(e, trial, s)).length;
}

/** Sort results. "Recommended" with a search means best match first; without one, available courses first. */
export function sortEntries(list: Entry[], sort: string, q = "") {
  const mins = (e: Entry) =>
    e.kind === "course" ? stats(e.course).minutes : Number.POSITIVE_INFINITY;
  const out = [...list];
  if (sort === "az") out.sort((a, b) => a.course.title.localeCompare(b.course.title));
  else if (sort === "short") out.sort((a, b) => mins(a) - mins(b));
  else if (sort === "long") out.sort((a, b) => e2n(b, mins) - e2n(a, mins));
  else {
    const found = courseScores(q);
    out.sort(
      (a, b) =>
        (found ? rank(b, found.scores) - rank(a, found.scores) : 0) ||
        Number(a.kind === "upcoming") - Number(b.kind === "upcoming"),
    );
  }
  return out;
}
/** Relevance for sorting. A planned course is only a title and a topic list, so it yields to a real course of
 * similar relevance. */
const rank = (e: Entry, scores: Map<string, number>) =>
  (scores.get(e.course.slug) ?? 0) * (e.kind === "upcoming" ? 0.75 : 1);
const e2n = (e: Entry, f: (e: Entry) => number) => (Number.isFinite(f(e)) ? f(e) : -1);
