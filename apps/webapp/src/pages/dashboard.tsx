import { Link } from "react-router-dom";
import { Award, Bookmark, GraduationCap, Layers, NotebookPen, PlayCircle } from "lucide-react";
import { CourseMasteryBar, UnitLadder, MasteryBadge } from "@/components/mastery";
import { buttonVariants } from "@/components/ui/button";
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
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
                  <QuizScores course={c} />
                </div>
              </section>
            );
          })}
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-xl font-semibold">Study activity</h2>
            <ActivityHeatmap activity={s.activity} />
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
