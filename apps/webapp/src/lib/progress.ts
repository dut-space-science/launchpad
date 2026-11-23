import type { Course } from "@/data/types";
import { QUIZ_PASS, lessonsOf } from "@/data/courses";
import { useStore, type State } from "@/store/store";

export function courseProgress(c: Course, s: Pick<State, "completed" | "quizzes">) {
  const lessons = lessonsOf(c);
  const done = lessons.filter((l) => s.completed[`${c.slug}/${l.id}`]).length;
  const quizzesPassed = c.modules.filter((m) => s.quizzes[`${c.slug}/${m.id}`]?.passed).length;
  const total = lessons.length + c.modules.length;
  const pct = Math.round(((done + quizzesPassed) / total) * 100);
  const next = lessons.find((l) => !s.completed[`${c.slug}/${l.id}`]);
  const minutesDone = lessons
    .filter((l) => s.completed[`${c.slug}/${l.id}`])
    .reduce((a, l) => a + l.minutes, 0);
  return {
    done,
    lessonsTotal: lessons.length,
    quizzesPassed,
    quizzesTotal: c.modules.length,
    pct,
    next,
    minutesDone,
    complete: done === lessons.length && quizzesPassed === c.modules.length,
  };
}

export function useCourseProgress(c: Course) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  return courseProgress(c, { completed, quizzes });
}

export { QUIZ_PASS };
