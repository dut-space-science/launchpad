import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FlaskConical,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CourseArt, CourseCard } from "@/components/course-card";
import { TopicBrowser, topicView } from "@/components/topic-browser";
import { courseScores } from "@/lib/explore-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { fields, disciplineById, fieldById } from "@/data/taxonomy";
import {
  AVAIL,
  DURATIONS,
  FEATURES,
  LEVELS,
  PROGRESS,
  SORTS,
  entries,
  facetCount,
  INSTITUTIONS,
  matches,
  primary,
  sortEntries,
  stats,
  type Entry,
  type FacetKey,
  type Filters,
  type ProgressState,
} from "@/lib/catalog";
import { minutes } from "@/lib/format";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

const FLAT_FACETS: { key: FacetKey; title: string; options: { value: string; label: string }[] }[] =
  [
    { key: "lvl", title: "Level", options: LEVELS.map((l) => ({ value: l, label: l })) },
    { key: "inst", title: "Institution", options: INSTITUTIONS },
    {
      key: "dur",
      title: "Duration",
      options: DURATIONS.map((d) => ({ value: d.value, label: d.label })),
    },
    { key: "feat", title: "Includes", options: FEATURES },
    { key: "prog", title: "My progress", options: PROGRESS },
    { key: "avail", title: "Availability", options: AVAIL },
  ];
const ALL_KEYS: FacetKey[] = ["field", "disc", "lvl", "inst", "dur", "feat", "prog", "avail"];

function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters: Filters = {
    q: params.get("q") ?? "",
    field: params.getAll("field"),
    disc: params.getAll("disc"),
    lvl: params.getAll("lvl"),
    inst: params.getAll("inst"),
    dur: params.getAll("dur"),
    feat: params.getAll("feat"),
    prog: params.getAll("prog"),
    avail: params.getAll("avail"),
  };
  const sort = params.get("sort") ?? "recommended";
  const view = params.get("view") === "list" ? "list" : "grid";
  const by = params.get("by") === "topics" ? "topics" : "courses";
  // The URL is the single source of truth, so searches and filters can be shared and survive the back button.
  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    fn(next);
    setParams(next, { replace: true });
  };
  const toggle = (key: FacetKey, value: string) =>
    update((p) => {
      const cur = p.getAll(key);
      p.delete(key);
      (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) =>
        p.append(key, v),
      );
    });
  const set = (key: string, value: string, empty = "") =>
    update((p) => (value === empty ? p.delete(key) : p.set(key, value)));
  const clear = () => update((p) => ["q", ...ALL_KEYS].forEach((k) => p.delete(k)));
  return { filters, sort, view, by, toggle, set, clear };
}

function Option({
  id,
  label,
  count,
  checked,
  onChange,
  className,
}: {
  id: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        count === 0 && !checked && "opacity-50",
        className,
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{count}</span>
      </label>
    </div>
  );
}

/** Fields (the knowledge tree's top-level branches) with their disciplines nested underneath. */
function FieldTree({
  filters,
  toggle,
  state,
}: {
  filters: Filters;
  toggle: (k: FacetKey, v: string) => void;
  state: ProgressState;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-base font-semibold">Field</legend>
      {fields.map((f) => {
        const hasPick = filters.disc.some((d) => f.disciplines.some((x) => x.id === d));
        const expanded = open[f.id] ?? (hasPick || filters.field.includes(f.id));
        return (
          <div key={f.id}>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${f.name}`}
                onClick={() => setOpen((o) => ({ ...o, [f.id]: !expanded }))}
              >
                <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
              </Button>
              <Option
                className="flex-1 py-1"
                id={`f-field-${f.id}`}
                label={f.name}
                count={facetCount("field", f.id, filters, state)}
                checked={filters.field.includes(f.id)}
                onChange={() => toggle("field", f.id)}
              />
            </div>
            {expanded && (
              <div className="ml-7 space-y-1.5 border-l pb-2 pl-3">
                {f.disciplines.map((d) => (
                  <Option
                    key={d.id}
                    id={`f-disc-${d.id}`}
                    label={d.name}
                    count={facetCount("disc", d.id, filters, state)}
                    checked={filters.disc.includes(d.id)}
                    onChange={() => toggle("disc", d.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function FilterPanel({
  filters,
  toggle,
  state,
}: {
  filters: Filters;
  toggle: (k: FacetKey, v: string) => void;
  state: ProgressState;
}) {
  return (
    <div className="space-y-6">
      <FieldTree filters={filters} toggle={toggle} state={state} />
      {FLAT_FACETS.filter((f) => f.options.length > 0).map((f) => (
        <fieldset key={f.key} className="space-y-2">
          <legend className="mb-1 text-base font-semibold">{f.title}</legend>
          {f.options.map((o) => (
            <Option
              key={o.value}
              id={`f-${f.key}-${o.value}`}
              label={o.label}
              count={facetCount(f.key, o.value, filters, state)}
              checked={filters[f.key].includes(o.value)}
              onChange={() => toggle(f.key, o.value)}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/** Field and discipline badges for a catalog entry. */
function Tags({ e }: { e: Entry }) {
  const { field, discipline } = primary(e);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {field && (
        <Badge variant="secondary" className="max-w-full min-w-0 shrink" title={field.name}>
          <span className="truncate">{field.name}</span>
        </Badge>
      )}
      <Badge variant="outline">{e.course.level}</Badge>
      {e.kind === "upcoming" && (
        <Badge variant="outline" className="border-dashed text-muted-foreground">
          Coming soon
        </Badge>
      )}
      <span className="sr-only">{discipline?.name}</span>
    </div>
  );
}

function UpcomingCard({ e, list }: { e: Extract<Entry, { kind: "upcoming" }>; list?: boolean }) {
  const c = e.course;
  const d = disciplineById(c.discipline);
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-dashed bg-card/60",
        list ? "flex-col sm:flex-row" : "flex-col",
      )}
      aria-label={`${c.title}, coming soon`}
    >
      <CourseArt
        course={c}
        muted
        className={list ? "hidden h-auto w-52 shrink-0 sm:block" : "aspect-[2/1]"}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <Tags e={e} />
        <h3 className="text-xl leading-snug font-semibold">{c.title}</h3>
        <p className="text-muted-foreground">{c.subtitle}</p>
        {d && <p className="mt-auto text-sm text-muted-foreground">Knowledge tree {d.code}</p>}
      </div>
    </div>
  );
}

function CourseRow({ e }: { e: Extract<Entry, { kind: "course" }> }) {
  const c = e.course;
  const st = stats(c);
  return (
    <Link
      to={`/courses/${c.slug}`}
      className="group flex overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50"
    >
      <CourseArt course={c} className="hidden h-auto w-52 shrink-0 object-cover sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
        <Tags e={e} />
        <h3 className="text-xl leading-snug font-semibold group-hover:text-primary">{c.title}</h3>
        <p className="text-muted-foreground">{c.subtitle}</p>
        <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" /> {st.lessons} lessons
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical className="size-4" /> {st.labs} labs
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {minutes(st.minutes)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm font-medium hover:bg-muted"
      aria-label={`Remove filter: ${label}`}
    >
      {label} <X className="size-3.5" />
    </button>
  );
}

export function Catalog() {
  const { filters, sort, view, by, toggle, set, clear } = useFilters();
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const enrolled = useStore((s) => s.enrolled);
  const state = useMemo(() => ({ completed, quizzes, enrolled }), [completed, quizzes, enrolled]);
  const [sheet, setSheet] = useState(false);

  const results = useMemo(
    () =>
      sortEntries(
        entries.filter((e) => matches(e, filters, state)),
        sort,
        filters.q,
      ),
    [filters, state, sort],
  );
  // Topics are searched lesson by lesson, so the course-level text match is left out of the filters.
  const topicEntries = useMemo(
    () => entries.filter((e) => matches(e, { ...filters, q: "" }, state)),
    [filters, state],
  );
  const topics = useMemo(() => topicView(topicEntries, filters.q), [topicEntries, filters.q]);
  const topicCount = topics.count;
  const partialCourses = by === "courses" && !!courseScores(filters.q)?.partial;
  const label = (key: FacetKey, v: string) =>
    key === "field"
      ? (fieldById(v)?.name ?? v)
      : key === "disc"
        ? (disciplineById(v)?.name ?? v)
        : (FLAT_FACETS.find((f) => f.key === key)?.options.find((o) => o.value === v)?.label ?? v);
  const chips = ALL_KEYS.flatMap((key) =>
    filters[key].map((v) => ({ key, value: v, label: label(key, v) })),
  );
  const active = chips.length + (filters.q ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold">Explore</h1>
        <p className="text-muted-foreground">
          {entries.length} courses across {fields.length} fields. Search, filter and sort to find
          what to learn next.
        </p>
      </header>

      <div className="mb-4 inline-flex rounded-lg border p-0.5" role="group" aria-label="Browse by">
        {(
          [
            ["courses", "Courses"],
            ["topics", "Topics"],
          ] as const
        ).map(([v, name]) => (
          <Button
            key={v}
            variant={by === v ? "secondary" : "ghost"}
            className="h-10 px-5 text-base"
            aria-pressed={by === v}
            onClick={() => set("by", v, "courses")}
          >
            {name}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
          <Input
            className="h-11 pl-10 text-base"
            placeholder={by === "topics" ? "Search topics" : "Search courses, fields and topics"}
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            aria-label={by === "topics" ? "Search topics" : "Search courses"}
          />
        </div>
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetTrigger render={<Button variant="outline" className="h-11 lg:hidden" />}>
            <SlidersHorizontal /> Filters{active ? ` (${active})` : ""}
          </SheetTrigger>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <FilterPanel filters={filters} toggle={toggle} state={state} />
            </div>
          </SheetContent>
        </Sheet>
        {by === "courses" && (
          <Select
            value={sort}
            onValueChange={(v) => set("sort", v as string, "recommended")}
            items={SORTS}
          >
            <SelectTrigger className="h-11 w-48" aria-label="Sort courses">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {by === "courses" && (
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Layout">
            {(
              [
                ["grid", LayoutGrid, "Grid"],
                ["list", List, "List"],
              ] as const
            ).map(([v, Icon, name]) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="icon"
                aria-label={`${name} view`}
                aria-pressed={view === v}
                onClick={() => set("view", v, "grid")}
              >
                <Icon />
              </Button>
            ))}
          </div>
        )}
      </div>

      {active > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.q && <Chip label={`“${filters.q}”`} onRemove={() => set("q", "")} />}
          {chips.map((c) => (
            <Chip
              key={`${c.key}-${c.value}`}
              label={c.label}
              onRemove={() => toggle(c.key, c.value)}
            />
          ))}
          <Button variant="link" size="sm" onClick={clear}>
            Clear all
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto pr-2">
            <FilterPanel filters={filters} toggle={toggle} state={state} />
          </div>
        </aside>
        <section aria-live="polite" className="min-w-0">
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {by === "topics"
              ? `${topicCount} ${topicCount === 1 ? "topic" : "topics"}`
              : `${results.length} ${results.length === 1 ? "course" : "courses"}`}
          </p>
          {partialCourses && results.length > 0 && (
            <p className="mb-4 rounded-lg border border-dashed p-3 text-muted-foreground">
              No course matches every word. These match the most.
            </p>
          )}
          {by === "topics" ? (
            topicCount === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <h2 className="text-xl font-semibold">No topics match</h2>
                <p className="mt-1 text-muted-foreground">
                  Try a different search or remove a filter.
                </p>
                <Button className="mt-4" variant="outline" onClick={clear}>
                  Clear all filters
                </Button>
              </div>
            ) : (
              <TopicBrowser view={topics} />
            )
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <h2 className="text-xl font-semibold">No courses match</h2>
              <p className="mt-1 text-muted-foreground">
                Try a different search or remove a filter.
              </p>
              <Button className="mt-4" variant="outline" onClick={clear}>
                Clear all filters
              </Button>
            </div>
          ) : view === "list" ? (
            <div className="space-y-4">
              {results.map((e) =>
                e.kind === "course" ? (
                  <CourseRow key={e.course.slug} e={e} />
                ) : (
                  <UpcomingCard key={e.course.slug} e={e} list />
                ),
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((e) =>
                e.kind === "course" ? (
                  <CourseCard key={e.course.slug} course={e.course} />
                ) : (
                  <UpcomingCard key={e.course.slug} e={e} />
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
