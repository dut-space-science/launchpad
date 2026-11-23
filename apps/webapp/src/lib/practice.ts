import type { Course, Pack, Problem } from "@/data/types";

export const MIXED_ID = "mixed-review";
export const MIXED_SIZE = 10;
export const MASTERED = 0.8;

/** Concept-check packs are built from each unit's quiz questions, so quiz content is written once. */
function conceptPacks(course: Course): Pack[] {
  return course.modules
    .filter((m) => m.quiz.length)
    .map((m, i) => ({
      id: `${m.id}-concepts`,
      unit: m.id,
      title: `Unit ${i + 1} concept checks`,
      blurb: `Quick multiple-choice questions on ${m.title.toLowerCase()}.`,
      kind: "concept" as const,
      problems: m.quiz.map((q, k): Problem => ({
        id: `${m.id}-q${k}`,
        kind: "mcq",
        difficulty: 1,
        prompt: q.q,
        options: q.options,
        answer: q.answer,
        solution: q.why,
      })),
    }));
}

/** Every pack for a course: concept checks, authored problem sets, then the mixed review. */
export function allPacks(course: Course): Pack[] {
  const concepts = conceptPacks(course);
  const authored = course.practice ?? [];
  const pool = concepts.flatMap((p) => p.problems);
  const mixed: Pack = {
    id: MIXED_ID,
    unit: "mixed",
    title: "Mixed review",
    blurb: `${MIXED_SIZE} random concept questions from across the course. Different every time.`,
    kind: "mixed",
    problems: pool.slice(0, MIXED_SIZE),
  };
  const order = (p: Pack) => course.modules.findIndex((m) => m.id === p.unit);
  return [
    ...[...concepts, ...authored].sort(
      (a, b) => order(a) - order(b) || (a.kind === "concept" ? -1 : 1),
    ),
    mixed,
  ];
}

export const packSize = (p: Pack) => p.problems.length;
export const packMinutes = (p: Pack) =>
  Math.max(
    3,
    Math.round(
      p.problems.reduce((s, q) => s + (q.kind === "mcq" ? 1 : q.kind === "numeric" ? 3 : 4), 0),
    ),
  );
export const packDifficulty = (p: Pack) =>
  Math.max(
    1,
    Math.round(p.problems.reduce((s, q) => s + q.difficulty, 0) / Math.max(1, p.problems.length)),
  );

/** The problems to actually run: the mixed pack draws a fresh random set each time. */
export function problemsFor(course: Course, pack: Pack): Problem[] {
  if (pack.kind !== "mixed") return pack.problems;
  const pool = conceptPacks(course).flatMap((p) => p.problems);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, MIXED_SIZE);
}

export function parseNumber(input: string) {
  const v = Number(input.trim().replace(/,/g, "").replace(/\s+/g, "").replace(/×/g, "e"));
  return input.trim() === "" || !Number.isFinite(v) ? null : v;
}

export function checkNumeric(input: string, p: Problem): "correct" | "wrong" | "invalid" {
  const n = parseNumber(input);
  if (n === null || !p.numeric) return "invalid";
  const { value, tolerance } = p.numeric;
  return Math.abs(n - value) <= Math.abs(value) * tolerance + 1e-12 ? "correct" : "wrong";
}

export const KIND_LABEL: Record<Pack["kind"], string> = {
  concept: "Concept checks",
  problems: "Problem set",
  mixed: "Mixed review",
};
