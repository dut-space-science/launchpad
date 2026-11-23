import type { Course, Module } from "@/data/types";
import type { State } from "@/store/store";

/** Mastery levels, in order. Rules are deliberately simple so learners can predict them. */
export type Level = "none" | "attempted" | "familiar" | "proficient" | "mastered";

export const LEVELS: {
  key: Level;
  label: string;
  hint: string;
  color: string;
  fraction: number;
}[] = [
  {
    key: "none",
    label: "Not started",
    hint: "Nothing done yet",
    color: "var(--m-none)",
    fraction: 0,
  },
  {
    key: "attempted",
    label: "Attempted",
    hint: "You've started a lesson or quiz",
    color: "var(--m-attempted)",
    fraction: 0.25,
  },
  {
    key: "familiar",
    label: "Familiar",
    hint: "All lessons finished",
    color: "var(--m-familiar)",
    fraction: 0.5,
  },
  {
    key: "proficient",
    label: "Proficient",
    hint: "Lessons finished and quiz passed (70%+)",
    color: "var(--m-proficient)",
    fraction: 0.75,
  },
  {
    key: "mastered",
    label: "Mastered",
    hint: "Lessons finished and quiz score of 90%+",
    color: "var(--m-mastered)",
    fraction: 1,
  },
];

export const levelInfo = (k: Level) => LEVELS.find((l) => l.key === k)!;

type S = Pick<State, "completed" | "quizzes">;

export function unitStatus(course: Course, m: Module, s: S) {
  const lessons = m.lessons.map((l) => ({
    id: l.id,
    done: !!s.completed[`${course.slug}/${l.id}`],
  }));
  const quiz = s.quizzes[`${course.slug}/${m.id}`];
  const doneCount = lessons.filter((l) => l.done).length;
  const allDone = doneCount === lessons.length;
  let level: Level = "none";
  if (doneCount > 0 || quiz) level = "attempted";
  if (allDone || quiz?.passed) level = "familiar";
  if (allDone && quiz?.passed) level = "proficient";
  if (allDone && quiz && quiz.best >= 0.9) level = "mastered";
  return { lessons, quiz, doneCount, allDone, level };
}

export function courseMastery(course: Course, s: S) {
  const units = course.modules.map((m) => ({ m, ...unitStatus(course, m, s) }));
  const counts = Object.fromEntries(LEVELS.map((l) => [l.key, 0])) as Record<Level, number>;
  units.forEach((u) => counts[u.level]++);
  return { units, counts };
}
