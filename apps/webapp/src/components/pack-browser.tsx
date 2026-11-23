import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, ListChecks, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course } from "@/data/types";
import {
  KIND_LABEL,
  MASTERED,
  allPacks,
  packDifficulty,
  packMinutes,
  packSize,
} from "@/lib/practice";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import { createSearch } from "@/lib/search";

const TYPES = [
  { value: "all", label: "All types" },
  { value: "concept", label: "Concept checks" },
  { value: "problems", label: "Problem sets" },
  { value: "mixed", label: "Mixed review" },
];
const STATUSES = [
  { value: "all", label: "Any status" },
  { value: "new", label: "Not started" },
  { value: "going", label: "In progress" },
  { value: "done", label: "Mastered (80%+)" },
];

function Dots({ n }: { n: number }) {
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`Difficulty ${n} of 3`}
      title={["Easy", "Medium", "Hard"][n - 1]}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("size-2 rounded-full", i <= n ? "bg-primary" : "bg-muted-foreground/25")}
        />
      ))}
    </span>
  );
}

/** A course's question bank: every practice pack, searchable and filterable. Packs open in the runner. */
export function PackBrowser({ course }: { course: Course }) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const unit = params.get("unit") ?? "all";
  const type = params.get("type") ?? "all";
  const status = params.get("status") ?? "all";
  const results = useStore((s) => s.practice);
  const set = (k: string, v: string, empty = "all") => {
    const n = new URLSearchParams(params);
    if (v === empty || v === "") n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  const packs = useMemo(() => allPacks(course), [course]);
  const unitOptions = [
    { value: "all", label: "All units" },
    ...course.modules.map((m, i) => ({ value: m.id, label: `Unit ${i + 1}: ${m.title}` })),
  ];
  const searcher = useMemo(
    () =>
      createSearch(packs, (p) => [
        { text: p.title, weight: 6 },
        { text: p.blurb, weight: 3 },
        { text: KIND_LABEL[p.kind], weight: 1 },
        {
          text: p.problems.map((x) => `${x.prompt} ${x.options?.join(" ") ?? ""}`).join(" "),
          weight: 1,
        },
      ]),
    [packs],
  );
  const found = searcher.search(q);
  const shown = (found.empty ? packs : found.results.map((r) => r.item)).filter((p) => {
    const r = results[`${course.slug}/${p.id}`];
    const st = !r ? "new" : r.best >= MASTERED ? "done" : "going";
    return (
      (unit === "all" || p.unit === unit) &&
      (type === "all" || p.kind === type) &&
      (status === "all" || st === status)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
          <Input
            className="h-11 pl-10 text-base"
            placeholder="Search packs"
            value={q}
            onChange={(e) => set("q", e.target.value, "")}
            aria-label="Search question packs"
          />
        </div>
        {(
          [
            ["unit", unit, unitOptions, "w-64", "Unit"],
            ["type", type, TYPES, "w-44", "Type"],
            ["status", status, STATUSES, "w-44", "Status"],
          ] as const
        ).map(([key, value, items, w, label]) => (
          <Select
            key={key}
            value={value}
            onValueChange={(v) => set(key, v as string)}
            items={items}
          >
            <SelectTrigger className={cn("h-11", w)} aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {shown.length} {shown.length === 1 ? "pack" : "packs"}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No packs match those filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((p) => {
            const r = results[`${course.slug}/${p.id}`];
            const idx = course.modules.findIndex((m) => m.id === p.unit);
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{KIND_LABEL[p.kind]}</Badge>
                  {idx >= 0 && <Badge variant="outline">Unit {idx + 1}</Badge>}
                </div>
                <h2 className="text-xl font-semibold">{p.title}</h2>
                <p className="text-muted-foreground">{p.blurb}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="size-4" /> {p.kind === "mixed" ? "10" : packSize(p)}{" "}
                    questions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" /> about {p.kind === "mixed" ? 10 : packMinutes(p)}{" "}
                    min
                  </span>
                  <Dots n={packDifficulty(p)} />
                </div>
                <div className="flex items-center justify-between gap-3 border-t pt-3">
                  <span className="text-sm">
                    {r ? (
                      <>
                        Best score <strong>{Math.round(r.best * 100)}%</strong>, {r.attempts}{" "}
                        {r.attempts === 1 ? "attempt" : "attempts"}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not started</span>
                    )}
                  </span>
                  <Link
                    to={`/practice/${course.slug}/${p.id}`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    {r ? "Practise again" : "Start"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
