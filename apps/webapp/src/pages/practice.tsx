import { PackBrowser } from "@/components/pack-browser";
import { courses } from "@/data/courses";
import { allPacks, packSize } from "@/lib/practice";

/** The question bank for a course. Packs open in the runner. */
export function Practice() {
  const course = courses[0];
  const packs = allPacks(course);
  const totalQ = packs.filter((p) => p.kind !== "mixed").reduce((s, p) => s + packSize(p), 0);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Practice</h1>
        <p className="text-muted-foreground">
          {packs.length} question packs, {totalQ} questions, with solutions after each answer.
        </p>
      </header>
      <PackBrowser course={course} />
    </div>
  );
}
