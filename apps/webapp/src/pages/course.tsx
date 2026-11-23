import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  PlayCircle,
  User,
} from "lucide-react";
import { CourseMasteryBar, LessonStateIcon, MasteryBadge, UnitLadder } from "@/components/mastery";
import { PackBrowser } from "@/components/pack-browser";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QUIZ_PASS,
  courseMinutes,
  getCourse,
  lessonCount,
  lessonsOf,
  unitLabs,
} from "@/data/courses";
import { disciplineById } from "@/data/taxonomy";
import { LAB_REGISTRY } from "@/labs";
import { unitStatus } from "@/lib/mastery";
import { useCourseProgress } from "@/lib/progress";
import { minutes } from "@/lib/format";
import { actions, useStore } from "@/store/store";
import { NotFound } from "@/pages/not-found";
import { cn } from "@/lib/utils";

export function CoursePage() {
  const { slug } = useParams();
  const course = getCourse(slug);
  if (!course) return <NotFound />;
  return <CourseInner slug={course.slug} />;
}

function CourseInner({ slug }: { slug: string }) {
  const course = getCourse(slug)!;
  const discipline = disciplineById(course.discipline);
  const field = discipline?.field;
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "units";
  const p = useCourseProgress(course);
  const enrolled = useStore((s) => !!s.enrolled[slug]);
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const labIds = [
    ...new Set(
      lessonsOf(course)
        .flatMap((l) => l.blocks)
        .flatMap((b) => (b.t === "lab" ? [b.id] : [])),
    ),
  ];
  const start = p.next ?? lessonsOf(course)[0];
  const videoCount = lessonsOf(course).filter((l) => l.videos?.length).length;

  const go = () => {
    actions.enroll(slug);
    void nav(`/learn/${slug}/${start.id}`);
  };

  return (
    <>
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-4">
            <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
              <Link className="hover:text-primary" to="/courses">
                Courses
              </Link>
              {field && (
                <>
                  {" / "}
                  <Link className="hover:text-primary" to={`/courses?field=${field.id}`}>
                    {field.name}
                  </Link>
                </>
              )}
              {discipline && ` / ${discipline.name}`}
            </nav>
            <h1 className="max-w-3xl text-3xl leading-tight font-semibold text-balance md:text-4xl">
              {course.title}
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">{course.subtitle}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
              <Badge variant="secondary">{course.level}</Badge>
              <span className="flex items-center gap-1.5">
                <User className="size-4" /> {course.instructor.name}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {minutes(courseMinutes(course))}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-4" /> {lessonCount(course)} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <FlaskConical className="size-4" /> {labIds.length} labs
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                size="lg"
                className="h-11 bg-gold px-5 text-base text-gold-foreground hover:bg-gold/90"
                onClick={go}
              >
                <PlayCircle />{" "}
                {!enrolled
                  ? "Start the course"
                  : p.complete
                    ? "Review the course"
                    : p.done
                      ? `Continue with ${start.title}`
                      : "Start the course"}
              </Button>
              {p.complete && (
                <Link
                  to={`/certificate/${slug}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 px-5 text-base",
                  )}
                >
                  <Award /> Get your certificate
                </Link>
              )}
            </div>
          </div>
          <aside
            className="space-y-3 self-start rounded-xl border bg-background p-5"
            aria-label="Your course mastery"
          >
            <h2 className="text-lg font-semibold">Course mastery</h2>
            <CourseMasteryBar course={course} />
            <p className="text-sm text-muted-foreground">
              {p.done} of {p.lessonsTotal} lessons finished, {p.quizzesPassed} of {p.quizzesTotal}{" "}
              quizzes passed.
            </p>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const n = new URLSearchParams(params);
            if (v === "units") n.delete("tab");
            else n.set("tab", v as string);
            setParams(n, { replace: true });
          }}
        >
          <TabsList variant="line" className="w-fit justify-start">
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="bank">Question bank</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reading">Reading list</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-5 pt-6">
            {course.modules.map((m, mi) => {
              const st = unitStatus(course, m, { completed, quizzes });
              const nextId = start.id;
              return (
                <section
                  key={m.id}
                  className="overflow-hidden rounded-xl border bg-card"
                  aria-labelledby={`u-${m.id}`}
                >
                  <header className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 id={`u-${m.id}`} className="text-xl font-semibold">
                        Unit {mi + 1}: {m.title}
                      </h2>
                      <MasteryBadge level={st.level} />
                    </div>
                    <p className="max-w-2xl text-muted-foreground">{m.summary}</p>
                    <UnitLadder
                      course={course}
                      moduleId={m.id}
                      nextId={p.complete ? undefined : start.id}
                    />
                  </header>
                  <ul className="divide-y border-t">
                    {m.lessons.map((l) => {
                      const done = !!completed[`${slug}/${l.id}`];
                      const isNext = l.id === nextId && !p.complete;
                      return (
                        <li key={l.id}>
                          <Link
                            to={`/learn/${slug}/${l.id}`}
                            onClick={() => actions.enroll(slug)}
                            className={cn(
                              "flex items-center gap-3 px-5 py-3 hover:bg-muted/60",
                              isNext && "bg-accent",
                            )}
                          >
                            <LessonStateIcon done={done} active={isNext} />
                            {l.videos?.length ? (
                              <PlayCircle
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-label="Video lesson"
                              />
                            ) : (
                              <FileText
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-label="Reading lesson"
                              />
                            )}
                            <span className="flex-1 font-medium">{l.title}</span>
                            {isNext && (
                              <Badge className="bg-gold text-gold-foreground">Up next</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {minutes(l.minutes)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                    {unitLabs(m).length > 0 && (
                      <li>
                        <Link
                          to={`/learn/${slug}/labs/${m.id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60"
                        >
                          <FlaskConical className="size-5 shrink-0 text-muted-foreground/70" />
                          <span className="flex-1 font-medium">
                            Labs{" "}
                            <span className="font-normal text-muted-foreground">
                              (
                              {unitLabs(m)
                                .map((id) => LAB_REGISTRY[id].title)
                                .join(", ")}
                              )
                            </span>
                          </span>
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        to={`/learn/${slug}/cards/${m.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60"
                      >
                        <Layers className="size-5 shrink-0 text-muted-foreground/70" />
                        <span className="flex-1 font-medium">
                          Flashcards{" "}
                          <span className="font-normal text-muted-foreground">
                            ({course.glossary.filter((g) => g.unit === m.id).length} terms)
                          </span>
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={`/learn/${slug}/quiz/${m.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60"
                      >
                        {st.quiz?.passed ? (
                          <CheckCircle2 className="size-5 shrink-0 text-m-proficient" />
                        ) : (
                          <ClipboardCheck className="size-5 shrink-0 text-muted-foreground/70" />
                        )}
                        <span className="flex-1 font-medium">
                          Unit quiz{" "}
                          <span className="font-normal text-muted-foreground">
                            ({m.quiz.length} questions)
                          </span>
                        </span>
                        {st.quiz && (
                          <span className="text-sm text-muted-foreground">
                            Best score {Math.round(st.quiz.best * 100)}%
                          </span>
                        )}
                      </Link>
                    </li>
                  </ul>
                </section>
              );
            })}
          </TabsContent>

          <TabsContent value="bank" className="space-y-8 pt-6">
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Unit quizzes</h2>
                <p className="text-sm text-muted-foreground">
                  Graded. Score {Math.round(QUIZ_PASS * 100)}% or more to pass a unit.
                </p>
              </div>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {course.modules
                  .filter((m) => m.quiz.length)
                  .map((m) => {
                    const r = quizzes[`${slug}/${m.id}`];
                    const idx = course.modules.findIndex((x) => x.id === m.id);
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            Unit {idx + 1}: {m.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {m.quiz.length} questions
                            {r &&
                              `, best ${Math.round(r.best * 100)}% in ${r.attempts} ${r.attempts === 1 ? "attempt" : "attempts"}`}
                          </p>
                        </div>
                        {r?.passed && <Badge>Passed</Badge>}
                        <Link
                          to={`/learn/${slug}/quiz/${m.id}`}
                          className={buttonVariants({
                            size: "sm",
                            variant: r ? "outline" : "default",
                          })}
                        >
                          {r ? "Retake" : "Start"}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Practice packs</h2>
                <p className="text-sm text-muted-foreground">
                  Ungraded practice with worked solutions after every answer.
                </p>
              </div>
              <PackBrowser course={course} />
            </section>
          </TabsContent>

          <TabsContent value="about" className="space-y-8 pt-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">What you'll be able to do</h2>
              <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-m-proficient" />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">About this course</h2>
              <p className="max-w-3xl leading-7 text-muted-foreground">{course.description}</p>
              <p className="text-muted-foreground">
                Includes {videoCount} video lessons, {labIds.length} labs, a quiz for every unit and
                a certificate when you finish.
              </p>
            </section>
            <div className="grid gap-8 sm:grid-cols-2">
              <section>
                <h2 className="mb-2 text-xl font-semibold">Before you start</h2>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {course.prerequisites.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="mb-2 text-xl font-semibold">Who it's for</h2>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {course.audience.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="reading" className="pt-6">
            <ul className="divide-y rounded-xl border bg-card">
              {course.library.map((r) => (
                <li key={r.title} className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-muted-foreground">
                      {r.org}
                      {r.note ? `. ${r.note}` : ""}
                    </div>
                  </div>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLink /> Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              NASA links open a search on the NASA Technical Reports Server so you land on the
              current official copy. Items marked "library" are in the team study library.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
