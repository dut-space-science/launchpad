import { Link } from "react-router-dom";
import { Clock, FlaskConical, PlayCircle } from "lucide-react";
import type { Course, Lesson, Module } from "@/data/types";
import { institutionOfChannel, type Entry } from "@/lib/catalog";
import { disciplineById } from "@/data/taxonomy";
import {
  searchLessons,
  searchPlanned,
  type LessonDoc,
  type PlannedDoc,
} from "@/lib/explore-search";
import type { SearchResult, Snippet } from "@/lib/search";
import { minutes } from "@/lib/format";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

type Group = {
  course: Course;
  units: { unit: Module; index: number; lessons: Lesson[] }[];
  count: number;
};
type Planned = { discipline: NonNullable<ReturnType<typeof disciplineById>>; topics: string[] };

export type TopicView =
  | { mode: "browse"; groups: Group[]; planned: Planned[]; count: number }
  | {
      mode: "search";
      lessons: SearchResult<LessonDoc>[];
      planned: SearchResult<PlannedDoc>[];
      partial: boolean;
      count: number;
    };

/**
 * What the Topics view shows for the filtered entries. Without a search: every lesson, grouped by course and unit,
 * then the planned topics. With a search: one list ranked by relevance (see lib/search), limited to the courses and
 * planned disciplines the filters allow.
 */
export function topicView(entries: Entry[], q: string): TopicView {
  const courseOk = new Set(entries.filter((e) => e.kind === "course").map((e) => e.course.slug));
  const plannedOk = new Set(
    entries.filter((e) => e.kind === "upcoming").map((e) => e.course.discipline),
  );
  const found = searchLessons(q);
  if (found.empty) {
    const groups = entries.flatMap((e) => {
      if (e.kind !== "course") return [];
      const units = e.course.modules.map((unit, index) => ({ unit, index, lessons: unit.lessons }));
      const count = units.reduce((n, u) => n + u.lessons.length, 0);
      return count ? [{ course: e.course, units, count }] : [];
    });
    const planned = entries.flatMap((e) => {
      const d = e.kind === "upcoming" ? disciplineById(e.course.discipline) : undefined;
      return d ? [{ discipline: d, topics: d.topics }] : [];
    });
    const count =
      groups.reduce((n, g) => n + g.count, 0) + planned.reduce((n, p) => n + p.topics.length, 0);
    return { mode: "browse", groups, planned, count };
  }
  const lessons = found.results.filter((r) => courseOk.has(r.item.course.slug));
  const plannedFound = searchPlanned(q);
  const planned = plannedFound.results.filter((r) => plannedOk.has(r.item.discipline.id));
  // Items matching every word win: if either list has some, the other list's partial matches are dropped.
  const exact =
    (!found.partial && lessons.length > 0) || (!plannedFound.partial && planned.length > 0);
  const keepLessons = exact && found.partial ? [] : lessons;
  const keepPlanned = exact && plannedFound.partial ? [] : planned;
  const partial = !exact && keepLessons.length + keepPlanned.length > 0;
  return {
    mode: "search",
    lessons: keepLessons,
    planned: keepPlanned,
    partial,
    count: keepLessons.length + keepPlanned.length,
  };
}

function Meta({ lesson }: { lesson: Lesson }) {
  const inst = [
    ...new Set((lesson.videos ?? []).map((v) => institutionOfChannel(v.channel))),
  ].filter((x): x is string => !!x);
  const labs = lesson.blocks.filter((b) => b.t === "lab").length;
  return (
    <span className="flex items-start gap-3 text-sm whitespace-nowrap text-muted-foreground sm:pt-1">
      {inst.length > 0 && <span>{inst.join(", ")}</span>}
      {lesson.videos?.length ? <PlayCircle className="size-4" aria-label="Has video" /> : null}
      {labs > 0 && <FlaskConical className="size-4" aria-label="Has lab" />}
      <span className="flex items-center gap-1">
        <Clock className="size-4" /> {minutes(lesson.minutes)}
      </span>
    </span>
  );
}

function LessonRow({
  course,
  lesson,
  context,
  snippet,
}: {
  course: Course;
  lesson: Lesson;
  context?: string;
  snippet?: Snippet;
}) {
  const done = useStore((s) => !!s.completed[`${course.slug}/${lesson.id}`]);
  return (
    <li>
      <Link
        to={`/learn/${course.slug}/${lesson.id}`}
        className="group grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <span className="min-w-0">
          {context && <span className="block text-sm text-muted-foreground">{context}</span>}
          <span
            className={cn("font-medium group-hover:text-primary", done && "text-muted-foreground")}
          >
            {lesson.title}
          </span>
          <span className="block text-muted-foreground">{lesson.summary}</span>
          {snippet && (
            <span className="mt-1 block border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
              {snippet.before}
              <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{snippet.hit}</mark>
              {snippet.after}
            </span>
          )}
        </span>
        <Meta lesson={lesson} />
      </Link>
    </li>
  );
}

function PlannedSection({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="t-planned" className="space-y-3">
      <header className="border-b pb-2">
        <h2 id="t-planned" className="text-xl font-semibold">
          Planned topics
        </h2>
        <p className="text-sm text-muted-foreground">On the knowledge tree, with no course yet.</p>
      </header>
      {children}
    </section>
  );
}

export function TopicBrowser({ view }: { view: TopicView }) {
  if (view.mode === "search")
    return (
      <div className="space-y-10">
        {view.partial && (
          <p className="rounded-lg border border-dashed p-3 text-muted-foreground">
            No topic matches every word. These match the most.
          </p>
        )}
        {view.lessons.length > 0 && (
          <ul className="divide-y" aria-label="Matching lessons, best first">
            {view.lessons.map(({ item, snippet }) => (
              <LessonRow
                key={`${item.course.slug}/${item.lesson.id}`}
                course={item.course}
                lesson={item.lesson}
                context={`${item.course.title}, unit ${item.unitIndex + 1}: ${item.unit.title}`}
                snippet={snippet}
              />
            ))}
          </ul>
        )}
        {view.planned.length > 0 && (
          <PlannedSection>
            <ul className="divide-y">
              {view.planned.map(({ item }) => (
                <li
                  key={`${item.discipline.id}/${item.topic}`}
                  className="py-2.5 text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{item.topic}</span>
                  <span className="block text-sm">
                    {item.discipline.code} {item.discipline.name}
                  </span>
                </li>
              ))}
            </ul>
          </PlannedSection>
        )}
      </div>
    );

  return (
    <div className="space-y-10">
      {view.groups.map((g) => (
        <section key={g.course.slug} aria-labelledby={`t-${g.course.slug}`} className="space-y-4">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 border-b pb-2">
            <h2 id={`t-${g.course.slug}`} className="text-xl font-semibold">
              <Link to={`/courses/${g.course.slug}`} className="hover:text-primary">
                {g.course.title}
              </Link>
            </h2>
            <span className="text-sm text-muted-foreground">
              {g.count} {g.count === 1 ? "topic" : "topics"}
            </span>
          </header>
          {g.units.map((u) => (
            <div key={u.unit.id}>
              <h3 className="text-base font-semibold text-muted-foreground">
                Unit {u.index + 1}: {u.unit.title}
              </h3>
              <ul className="divide-y">
                {u.lessons.map((l) => (
                  <LessonRow key={l.id} course={g.course} lesson={l} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {view.planned.length > 0 && (
        <PlannedSection>
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {view.planned.map((p) => (
              <li key={p.discipline.id} className="text-muted-foreground">
                <div className="font-medium text-foreground">
                  {p.discipline.code} {p.discipline.name}
                </div>
                <div>{p.topics.join(", ")}</div>
              </li>
            ))}
          </ul>
        </PlannedSection>
      )}
    </div>
  );
}
