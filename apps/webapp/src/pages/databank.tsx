import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Databank } from "@/components/databank";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { courses, findLesson, getCourse } from "@/data/courses";
import { unitStatus } from "@/lib/mastery";
import { useStore } from "@/store/store";

/** Ids of units the learner has started, plus the unit they last studied. */
function useStartedUnits(slug: string) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const last = useStore((s) => s.last);
  const course = getCourse(slug)!;
  return useMemo(() => {
    const ids = course.modules
      .filter((m) => unitStatus(course, m, { completed, quizzes }).level !== "none")
      .map((m) => m.id);
    if (last?.course === slug) {
      const f = findLesson(course, last.lesson);
      if (f && !ids.includes(f.module.id)) ids.push(f.module.id);
    }
    return course.modules.map((m) => m.id).filter((id) => ids.includes(id));
  }, [course, completed, quizzes, last, slug]);
}

export function DatabankPage() {
  const [params] = useSearchParams();
  const course = courses[0];
  const started = useStartedUnits(course.slug);
  const [scope, setScope] = useState<"mine" | "all">(started.length ? "mine" : "all");
  const units = scope === "mine" && started.length ? started : course.modules.map((m) => m.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold"> Databank</h1>
          <p className="text-muted-foreground">
            {scope === "mine" && started.length
              ? "From the units you've started."
              : "From every unit."}
          </p>
        </div>
        <Tabs
          value={scope}
          onValueChange={(v) => setScope(v as "mine" | "all")}
          className="no-print"
        >
          <TabsList>
            <TabsTrigger value="mine" disabled={started.length === 0}>
              My units
            </TabsTrigger>
            <TabsTrigger value="all">All units</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      <Databank
        key={`${scope}-${params.get("q") ?? ""}`}
        course={course}
        units={units}
        initialQuery={params.get("q") ?? ""}
      />
    </div>
  );
}
