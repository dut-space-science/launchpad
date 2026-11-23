import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, Bookmark, GraduationCap, Layers, NotebookPen, PlayCircle } from "lucide-react";
import { CourseMasteryBar, UnitLadder, MasteryBadge } from "@/components/mastery";
import { buttonVariants } from "@/components/ui/button";
import { QUIZ_PASS, courses, findLesson, getCourse } from "@/data/courses";
import { unitStatus } from "@/lib/mastery";
import { courseProgress } from "@/lib/progress";
import { dayKey, minutes } from "@/lib/format";
import { streak, useStore } from "@/store/store";
import { cn } from "@/lib/utils";

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-heading text-3xl font-semibold">{value}</div>
      {note && <div className="text-sm text-muted-foreground">{note}</div>}
    </div>
  );
}

/** Study activity: one-hue (gold) sequential ramp, 26 weeks, with weekday labels, legend and a hover/focus read-out. */
function Heatmap({ activity }: { activity: Record<string, number> }) {
  const weeks = 26;
  const today = new Date();
  const start = new Date(today);
  // Columns are weeks starting on Sunday, so row 1 is Sunday and the labels below line up.
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);
  const cells = Array.from({ length: (weeks - 1) * 7 + today.getDay() + 1 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { d, n: activity[dayKey(d)] ?? 0 };
  });
  const max = Math.max(4, ...cells.map((c) => c.n));
  const shade = (n: number) =>
    n === 0
      ? "var(--m-none)"
      : `color-mix(in oklch, var(--gold) ${Math.round(30 + (n / max) * 70)}%, var(--card))`;
  const [tip, setTip] = useState<string>("");
  const label = (c: (typeof cells)[number]) =>
    `${c.d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${c.n === 0 ? "no activity" : `${c.n} action${c.n === 1 ? "" : "s"}`}`;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] text-xs text-muted-foreground" aria-hidden>
          {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
            <span key={i} className="flex items-center">
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col grid-rows-7 gap-[3px]"
          role="group"
          aria-label="Study activity over the last 26 weeks"
        >
          {cells.map((c) => (
            <button
              type="button"
              key={c.d.toISOString()}
              aria-label={label(c)}
              onPointerEnter={() => setTip(label(c))}
              onFocus={() => setTip(label(c))}
              onPointerLeave={() => setTip("")}
              onBlur={() => setTip("")}
              className="aspect-square w-full cursor-default rounded-[3px] outline-offset-2 transition-transform hover:scale-125"
              style={{ background: shade(c.n) }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-h-5" role="status">
          {tip || "Hover or focus a day to see what you did."}
        </span>
        <span className="flex items-center gap-1.5">
          Less{" "}
          {[0, 1, 2, 4].map((n) => (
            <span
              key={n}
              className="size-3.5 rounded-[3px]"
              style={{ background: shade(n === 0 ? 0 : (n / 4) * max) }}
            />
          ))}{" "}
          More
        </span>
      </div>
    </div>
  );
}

/** Best quiz score per unit as horizontal bars on one baseline, one hue, with the pass mark drawn as a reference line. */
function QuizBars({ courseSlug }: { courseSlug: string }) {
  const course = getCourse(courseSlug)!;
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  return (
    <div className="space-y-2.5">
      {course.modules.map((m, i) => {
        const q = quizzes[`${course.slug}/${m.id}`];
        const pct = q ? Math.round(q.best * 100) : 0;
        void completed;
        return (
          <div
            key={m.id}
            className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm"
          >
            <span className="truncate" title={m.title}>
              Unit {i + 1}
            </span>
            <div
              className="relative h-4 rounded-r-[4px] bg-m-none/70"
              role="img"
              aria-label={`Unit ${i + 1} best score ${q ? pct + "%" : "not taken"}`}
            >
              {q && (
                <div
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-1"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div
                className="absolute -inset-y-1 w-px bg-foreground/60"
                style={{ left: `${QUIZ_PASS * 100}%` }}
              />
            </div>
            <span className="text-right font-semibold tabular-nums">{q ? `${pct}%` : "—"}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-2 pl-[calc(9rem+0.75rem)] text-xs text-muted-foreground">
        <span className="inline-block h-3 w-px bg-foreground/60" /> Pass mark {QUIZ_PASS * 100}%
      </div>
    </div>
  );
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Day streak"
          value={days}
          note={days ? "days in a row" : "Study today to start one"}
        />
        <Tile label="Study time" value={minutes(totalMin)} note="from finished lessons" />
        <Tile label="Quizzes passed" value={quizzesPassed} />
        <Tile label="Certificates" value={certs.length} />
      </div>

      {enrolled.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
          <h2 className="text-xl font-semibold">Start your first course</h2>
          <p className="max-w-md text-muted-foreground">
            Your mastery, quiz scores and study activity will show up here as you learn.
          </p>
          <Link to="/" className={buttonVariants()}>
            <GraduationCap /> Browse courses
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {enrolled.map((c) => {
            const p = courseProgress(c, s);
            return (
              <section
                key={c.slug}
                className="space-y-5 rounded-xl border bg-card p-5"
                aria-labelledby={`d-${c.slug}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id={`d-${c.slug}`} className="text-xl font-semibold">
                      <Link to={`/courses/${c.slug}`} className="hover:text-primary">
                        {c.title}
                      </Link>
                    </h2>
                    <p className="text-muted-foreground">
                      {p.done} of {p.lessonsTotal} lessons finished, {p.quizzesPassed} of{" "}
                      {p.quizzesTotal} quizzes passed
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {p.complete && (
                      <Link
                        to={`/certificate/${c.slug}`}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        <Award /> Certificate
                      </Link>
                    )}
                    <Link
                      to={`/learn/${c.slug}`}
                      className={cn(
                        buttonVariants(),
                        "bg-gold text-gold-foreground hover:bg-gold/90",
                      )}
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
                  <QuizBars courseSlug={c.slug} />
                </div>
              </section>
            );
          })}
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-xl font-semibold">Study activity</h2>
            <Heatmap activity={s.activity} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Layers className="size-4" /> Flashcards to review
            </h2>
            {dueUnits.length === 0 ? (
              <p className="text-muted-foreground">Nothing due. Each unit has its own deck.</p>
            ) : (
              <ul className="space-y-1.5">
                {dueUnits.map((u) => (
                  <li key={u.m.id}>
                    <Link
                      className="flex items-center justify-between gap-2 hover:text-primary"
                      to={`/learn/${u.c.slug}/cards/${u.m.id}`}
                    >
                      <span className="truncate">
                        Unit {u.i + 1}: {u.m.title}
                      </span>
                      <span className="shrink-0 font-semibold">{u.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Bookmark className="size-4" /> Bookmarks
            </h2>
            {marks.length === 0 ? (
              <p className="text-muted-foreground">Bookmark a lesson to find it here.</p>
            ) : (
              <ul className="space-y-1.5">
                {marks.map((k) => {
                  const r = resolve(k);
                  return (
                    r && (
                      <li key={k}>
                        <Link
                          className="hover:text-primary"
                          to={`/learn/${r.c.slug}/${r.lesson.id}`}
                        >
                          {r.lesson.title}
                        </Link>
                      </li>
                    )
                  );
                })}
              </ul>
            )}
          </section>
          <section className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <NotebookPen className="size-4" /> Notebook
            </h2>
            <p className="text-muted-foreground">
              {notes.length === 0
                ? "Notes you write in lessons are kept in your notebook."
                : `${notes.length} ${notes.length === 1 ? "note" : "notes"}, grouped by lesson.`}
            </p>
            <Link to="/notebook" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open notebook
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
