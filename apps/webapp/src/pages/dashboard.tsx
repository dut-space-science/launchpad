import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Award, Bookmark, GraduationCap, Layers, NotebookPen, PlayCircle } from "lucide-react";
import { CourseMasteryBar, UnitLadder, MasteryBadge } from "@/components/mastery";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type { Course } from "@/data/types";
import type { State } from "@/store/store";
import { courses, findLesson, getCourse } from "@/data/courses";
import { ActivityHeatmap, ActivitySpark, QuizScores } from "@/components/progress-charts";
import { unitStatus } from "@/lib/mastery";
import { courseProgress } from "@/lib/progress";
import { minutes } from "@/lib/format";
import { streak, useStore } from "@/store/store";
import { cn } from "@/lib/utils";

function Figure({
  label,
  value,
  note,
  trend,
}: {
  label: string;
  value: string | number;
  note?: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1 px-4 py-4 first:pl-0 sm:px-5 max-lg:odd:pl-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-end gap-3">
        <span className="font-heading text-3xl leading-none font-semibold tracking-tight sm:text-4xl">
          {value}
        </span>
        {trend}
      </div>
      {note && <div className="text-sm text-muted-foreground">{note}</div>}
    </div>
  );
}

/** A count shown beside a tab's name; nothing when there is none. */
function Count({ n }: { n: number }) {
  return n > 0 ? <span className="text-sm text-muted-foreground tabular-nums">{n}</span> : null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed p-8 text-muted-foreground">{children}</p>;
}

export function Dashboard() {
  const s = useStore((x) => x);
  const now = Date.now();
  const dueUnits = courses
    .filter((c) => s.enrolled[c.slug])
    .flatMap((c) =>
      c.modules.map((m, i) => ({
        c,
        m,
        i,
        n: c.glossary.filter(
          (g) => g.unit === m.id && (s.cards[`${c.slug}/${g.term}`]?.due ?? 0) <= now,
        ).length,
      })),
    )
    .filter((u) => u.n > 0);
  const enrolled = courses.filter((c) => s.enrolled[c.slug]);
  const totalMin = courses.reduce((a, c) => a + courseProgress(c, s).minutesDone, 0);
  const quizzesPassed = Object.values(s.quizzes).filter((q) => q.passed).length;
  const certs = courses.filter((c) => courseProgress(c, s).complete);
  const marks = Object.keys(s.bookmarks);
  const notes = Object.keys(s.notes);
  const resolve = (k: string) => {
    const [slug, id] = k.split("/");
    const c = getCourse(slug);
    const f = c && findLesson(c, id);
    return c && f ? { c, ...f } : undefined;
  };
  const days = streak(s.activity);
  const bookmarked = marks.flatMap((k) => resolve(k) ?? []);
  const [params, setParams] = useSearchParams();
  const bar = useRef<HTMLDivElement>(null);
  // The course list leads with the one studied last.
  const registerOrder = [...enrolled].sort(
    (x, y) => Number(y.slug === s.last?.course) - Number(x.slug === s.last?.course),
  );
  const wanted = params.get("tab");
  // The course card on show: the one in the address, else the one studied last, else the first.
  const shown =
    enrolled.find((c) => c.slug === params.get("course")) ??
    enrolled.find((c) => c.slug === s.last?.course) ??
    enrolled[0];
  // Everything the tabs show is about the course selected in the list.
  const myDue = dueUnits.filter((u) => u.c === shown);
  const totalDue = myDue.reduce((a, u) => a + u.n, 0);
  const myMarks = bookmarked.filter((r) => r.c === shown);
  const myNotes = notes.filter((k) => shown && k.startsWith(`${shown.slug}/`));
  const tab = ["courses", "flashcards", "bookmarks", "notebook"].includes(wanted ?? "")
    ? (wanted as string)
    : "courses";
  // On a narrow screen the tab row scrolls; keep the chosen tab in view (it may come from a link).
  useEffect(() => {
    const box = bar.current;
    const el = box?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!box || !el) return;
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + el.offsetWidth > box.scrollLeft + box.clientWidth)
      box.scrollTo({ left: left - 16, behavior: "auto" });
  }, [tab]);
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold">
          {s.profile.name ? `Welcome back, ${s.profile.name.split(" ")[0]}` : "My learning"}
        </h1>
        <p className="text-muted-foreground">
          {s.profile.name ? (
            "Here is where you left off."
          ) : (
            <>
              Add your name in{" "}
              <Link className="font-medium text-foreground hover:text-primary" to="/settings">
                Settings
              </Link>{" "}
              to personalise this page and your certificate.
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 divide-x border-y lg:grid-cols-4 max-lg:[&>*:nth-child(2)]:border-r-0 max-lg:[&>*:nth-child(n+3)]:border-t">
        <Figure
          label="Day streak"
          value={days}
          note={days ? "Last 14 days shown" : "Study today to start one"}
          trend={<ActivitySpark activity={s.activity} />}
        />
        <Figure label="Study time" value={minutes(totalMin)} note="From finished lessons" />
        <Figure label="Quizzes passed" value={quizzesPassed} />
        <Figure label="Certificates" value={certs.length} />
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-5" aria-labelledby="activity-title">
        <h2 id="activity-title" className="text-xl font-semibold">
          Study activity
        </h2>
        <ActivityHeatmap activity={s.activity} />
      </section>

      {!shown ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
          <h2 className="text-xl font-semibold">Start your first course</h2>
          <p className="max-w-md text-muted-foreground">
            Your mastery, quiz scores and study activity will show up here as you learn.
          </p>
          <Link to="/" className={buttonVariants()}>
            <GraduationCap /> Browse courses
          </Link>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            enrolled.length > 1 && "lg:grid-cols-[17rem_minmax(0,1fr)]",
          )}
        >
          {enrolled.length > 1 && (
            <CourseRegister
              list={registerOrder}
              active={shown.slug}
              onPick={(slug) => {
                const next = new URLSearchParams(params);
                next.set("course", slug);
                setParams(next, { replace: true });
              }}
            />
          )}
          <div className="min-w-0">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                const next = new URLSearchParams(params);
                if (v === "courses") next.delete("tab");
                else next.set("tab", v as string);
                setParams(next, { replace: true });
              }}
            >
              <div
                ref={bar}
                className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0"
              >
                <TabsList variant="line" className="w-max justify-start">
                  <TabsTrigger value="courses" className="gap-2 px-3 text-base">
                    <GraduationCap /> Progress
                  </TabsTrigger>
                  <TabsTrigger value="flashcards" className="gap-2 px-3 text-base">
                    <Layers /> Flashcards <Count n={totalDue} />
                  </TabsTrigger>
                  <TabsTrigger value="bookmarks" className="gap-2 px-3 text-base">
                    <Bookmark /> Bookmarks <Count n={myMarks.length} />
                  </TabsTrigger>
                  <TabsTrigger value="notebook" className="gap-2 px-3 text-base">
                    <NotebookPen /> Notebook <Count n={myNotes.length} />
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="courses" className="pt-6 text-base">
                <CoursePanel c={shown} s={s} />
              </TabsContent>

              <TabsContent value="flashcards" className="pt-6 text-base">
                {myDue.length === 0 ? (
                  <Empty>Nothing due in this course. Each unit has its own deck.</Empty>
                ) : (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">Flashcards to review</h2>
                    <ul className="mt-2 divide-y">
                      {myDue.map((u) => (
                        <li key={u.m.id}>
                          <Link
                            className="flex items-center justify-between gap-4 py-2.5 hover:text-primary"
                            to={`/learn/${u.c.slug}/cards/${u.m.id}`}
                          >
                            <span className="min-w-0 truncate">
                              Unit {u.i + 1}: {u.m.title}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                              {u.n} {u.n === 1 ? "card" : "cards"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="bookmarks" className="pt-6 text-base">
                {myMarks.length === 0 ? (
                  <Empty>Bookmark a lesson in this course to find it here.</Empty>
                ) : (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">Bookmarked lessons</h2>
                    <ul className="mt-2 divide-y">
                      {myMarks.map((r) => (
                        <li key={r.lesson.id}>
                          <Link
                            className="block py-2.5 hover:text-primary"
                            to={`/learn/${r.c.slug}/${r.lesson.id}`}
                          >
                            {r.lesson.title}
                            <span className="block text-sm text-muted-foreground">
                              {r.module.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="notebook" className="pt-6 text-base">
                <section className="space-y-3 rounded-xl border bg-card p-5">
                  <p className="text-muted-foreground">
                    {myNotes.length === 0
                      ? "Notes you write in this course's lessons are kept in your notebook."
                      : `${myNotes.length} ${myNotes.length === 1 ? "note" : "notes"} in this course, grouped by lesson.`}
                  </p>
                  <Link to="/notebook" className={buttonVariants({ variant: "outline" })}>
                    <NotebookPen /> Open notebook
                  </Link>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

/** One course's progress: mastery, units and best quiz scores. */
function CoursePanel({ c, s }: { c: Course; s: State }) {
  const p = courseProgress(c, s);
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5" aria-labelledby={`d-${c.slug}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`d-${c.slug}`} className="text-xl font-semibold">
            <Link to={`/courses/${c.slug}`} className="hover:text-primary">
              {c.title}
            </Link>
          </h2>
          <p className="text-muted-foreground">
            {p.done} of {p.lessonsTotal} lessons finished, {p.quizzesPassed} of {p.quizzesTotal}{" "}
            quizzes passed
          </p>
        </div>
        <div className="flex gap-2">
          {p.complete && (
            <Link to={`/certificate/${c.slug}`} className={buttonVariants({ variant: "outline" })}>
              <Award /> Certificate
            </Link>
          )}
          <Link
            to={`/learn/${c.slug}`}
            className={cn(buttonVariants(), "bg-gold text-gold-foreground hover:bg-gold/90")}
          >
            <PlayCircle /> {p.complete ? "Review" : "Continue"}
          </Link>
        </div>
      </div>
      <CourseMasteryBar course={c} />
      <div>
        <h3 className="mb-2 text-base font-semibold">Units</h3>
        <ul className="divide-y">
          {c.modules.map((m, i) => {
            const st = unitStatus(c, m, s);
            return (
              <li
                key={m.id}
                className="grid items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem]"
              >
                <Link
                  to={`/learn/${c.slug}/${st.lessons.find((l) => !l.done)?.id ?? m.lessons[0].id}`}
                  className="truncate font-medium hover:text-primary"
                >
                  Unit {i + 1}: {m.title}
                </Link>
                <UnitLadder course={c} moduleId={m.id} />
                <MasteryBadge level={st.level} className="sm:justify-self-end" />
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-base font-semibold">Best quiz score by unit</h3>
        <QuizScores course={c} />
      </div>
    </section>
  );
}

/**
 * Your courses as a list beside the tabs: picking one sets the course every tab shows. The list scrolls inside itself (so
 * it never lengthens the page) and gains a search box when it is long.
 */
function CourseRegister({
  list,
  active,
  onPick,
}: {
  list: Course[];
  active: string;
  onPick: (slug: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const rows = query ? list.filter((c) => c.title.toLowerCase().includes(query)) : list;
  return (
    <nav
      aria-label="Your courses"
      className="self-start overflow-hidden rounded-xl border bg-card lg:sticky lg:top-24"
    >
      <p className="border-b px-4 py-2.5 text-sm text-muted-foreground">{list.length} courses</p>
      {list.length > 6 && (
        <div className="border-b p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a course"
            aria-label="Find a course"
          />
        </div>
      )}
      <ol className="max-h-72 overflow-y-auto [scrollbar-width:thin] lg:max-h-[calc(100svh-15rem)]">
        {rows.map((c) => {
          const current = c.slug === active;
          return (
            <li key={c.slug}>
              <button
                type="button"
                aria-current={current || undefined}
                onClick={() => onPick(c.slug)}
                className={cn(
                  "w-full border-l-[3px] px-4 py-3 text-left leading-snug transition-colors",
                  current
                    ? "border-l-primary bg-muted font-semibold"
                    : "border-l-transparent font-medium hover:bg-muted/60",
                )}
              >
                {c.title}
              </button>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">No course matches.</li>
        )}
      </ol>
    </nav>
  );
}
