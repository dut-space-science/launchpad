import { lazy, Suspense, useEffect, useMemo, useState } from "react";

const NotesEditor = lazy(() => import("@/components/notes-editor"));
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import {
  Award,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Layers,
  ScrollText,
  ExternalLink,
  FileText,
  ListChecks,
  NotebookPen,
  Paperclip,
  PlayCircle,
  Check,
} from "lucide-react";
import { Databank } from "@/components/databank";
import { FlashDeck } from "@/components/flash-deck";
import { useFocusActive } from "@/lib/focus-mode";
import { LessonStateIcon, MasteryIcon } from "@/components/mastery";
import { unitStatus } from "@/lib/mastery";
import { Blocks } from "@/components/rich";
import { Quiz } from "@/components/quiz";
import { YouTubeEmbed } from "@/components/youtube";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUIZ_PASS, findLesson, getCourse, lessonsOf, unitLabs } from "@/data/courses";
import { LAB_REGISTRY } from "@/labs";
import type { Course, Lesson } from "@/data/types";
import { courseProgress } from "@/lib/progress";
import { minutes } from "@/lib/format";
import { useAttachments } from "@/store/folder";
import { LessonFiles } from "@/components/lesson-files";
import { actions, getState, useStore } from "@/store/store";
import { NotFound } from "@/pages/not-found";
import { cn } from "@/lib/utils";

export function Learn() {
  const { slug, lessonId, moduleId } = useParams();
  const path = useLocation().pathname;
  const isCards = path.includes("/cards/");
  const isLabs = path.includes("/labs/");
  const course = getCourse(slug);
  if (!course) return <NotFound />;
  if (!lessonId && !moduleId) {
    const s = getState();
    const resume =
      s.last?.course === course.slug && findLesson(course, s.last.lesson)
        ? s.last.lesson
        : (courseProgress(course, s).next?.id ?? lessonsOf(course)[0].id);
    return <Navigate to={`/learn/${course.slug}/${resume}`} replace />;
  }
  if (moduleId) {
    const m = course.modules.find((x) => x.id === moduleId);
    if (!m) return <NotFound />;
    if (isLabs) return <Shell course={course} labsModule={m.id} />;
    return isCards ? (
      <Shell course={course} cardsModule={m.id} />
    ) : (
      <Shell course={course} quizModule={m.id} />
    );
  }
  const found = findLesson(course, lessonId);
  return found ? <Shell course={course} lessonId={found.lesson.id} /> : <NotFound />;
}

function Shell({
  course,
  lessonId,
  quizModule,
  cardsModule,
  labsModule,
}: {
  course: Course;
  lessonId?: string;
  quizModule?: string;
  cardsModule?: string;
  labsModule?: string;
}) {
  const nav = useNavigate();
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const focusOn = useFocusActive();
  // Escape leaves focus mode (unless a dialog or panel is using it).
  useEffect(() => {
    if (!focusOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]'))
        actions.setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOn]);
  const p = courseProgress(course, { completed, quizzes });
  const flat = useMemo(() => {
    const out: {
      kind: "lesson" | "quiz" | "cards" | "labs";
      id: string;
      path: string;
      title: string;
    }[] = [];
    for (const m of course.modules) {
      for (const l of m.lessons)
        out.push({
          kind: "lesson",
          id: l.id,
          path: `/learn/${course.slug}/${l.id}`,
          title: l.title,
        });
      if (unitLabs(m).length)
        out.push({
          kind: "labs",
          id: m.id,
          path: `/learn/${course.slug}/labs/${m.id}`,
          title: `${m.title}: labs`,
        });
      out.push({
        kind: "cards",
        id: m.id,
        path: `/learn/${course.slug}/cards/${m.id}`,
        title: `${m.title}: flashcards`,
      });
      out.push({
        kind: "quiz",
        id: m.id,
        path: `/learn/${course.slug}/quiz/${m.id}`,
        title: `${m.title}: quiz`,
      });
    }
    return out;
  }, [course]);
  const idx = flat.findIndex((f) =>
    lessonId
      ? f.kind === "lesson" && f.id === lessonId
      : labsModule
        ? f.kind === "labs" && f.id === labsModule
        : cardsModule
          ? f.kind === "cards" && f.id === cardsModule
          : f.kind === "quiz" && f.id === quizModule,
  );
  const unitId = lessonId
    ? findLesson(course, lessonId)!.module.id
    : (quizModule ?? cardsModule ?? labsModule)!;
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  useEffect(() => {
    if (lessonId) actions.visit(course.slug, lessonId);
  }, [course.slug, lessonId]);

  const sidebar = (
    <Curriculum
      course={course}
      lessonId={lessonId}
      quizModule={quizModule}
      cardsModule={cardsModule}
      labsModule={labsModule}
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <div className={cn("flex flex-col", focusOn ? "min-h-svh" : "min-h-[calc(100svh-4rem)]")}>
      <div
        className={cn(
          "sticky z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur",
          focusOn ? "top-0" : "top-16",
        )}
      >
        <Link
          to={`/courses/${course.slug}`}
          className="flex min-w-0 items-center gap-1.5 text-sm font-medium hover:text-primary"
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="truncate">{course.title}</span>
        </Link>
        <div className="ml-auto hidden w-48 items-center gap-2 sm:flex">
          <Progress className="flex-1" value={p.pct} aria-label="Course progress" />
          <span className="text-xs text-muted-foreground tabular-nums">{p.pct}%</span>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <ScrollText /> Databank
          </SheetTrigger>
          <SheetContent
            side="right"
            className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
          >
            <SheetHeader>
              <SheetTitle>
                Databank: {course.modules.find((m) => m.id === unitId)?.title}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <Databank course={course} units={[unitId]} compact />
              <Link
                to="/databank"
                onClick={() => setSheetOpen(false)}
                className="mt-4 inline-block text-primary"
              >
                Open my full databank
              </Link>
            </div>
          </SheetContent>
        </Sheet>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="sm" className={focusOn ? "" : "lg:hidden"} />}
          >
            <ListChecks /> Curriculum
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Course content</SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-6">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div
        className={cn(
          "mx-auto grid w-full flex-1",
          focusOn ? "max-w-none" : "max-w-[96rem] lg:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <div className="min-w-0 px-4 py-6 lg:px-8">
          {lessonId ? (
            <LessonView
              course={course}
              lesson={findLesson(course, lessonId)!.lesson}
              moduleTitle={findLesson(course, lessonId)!.module.title}
              moduleId={findLesson(course, lessonId)!.module.id}
            />
          ) : labsModule ? (
            <LabsView course={course} moduleId={labsModule} />
          ) : cardsModule ? (
            <CardsView course={course} moduleId={cardsModule} />
          ) : (
            <QuizView course={course} moduleId={quizModule!} />
          )}
          <nav
            aria-label="Lesson navigation"
            className="mx-auto mt-12 grid max-w-4xl gap-3 border-t pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <button
                type="button"
                onClick={() => nav(prev.path)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted"
              >
                <ChevronLeft className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm text-muted-foreground">Previous</span>
                  <span className="block truncate font-medium">{prev.title}</span>
                </span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                onClick={() => nav(next.path)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-gold p-4 text-left text-gold-foreground transition-[filter] hover:brightness-105"
              >
                <span className="min-w-0">
                  <span className="block text-sm opacity-80">Up next</span>
                  <span className="block truncate font-semibold">{next.title}</span>
                </span>
                <ChevronRight className="size-5 shrink-0" />
              </button>
            ) : p.complete ? (
              <Link
                to={`/certificate/${course.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-gold p-4 font-semibold text-gold-foreground"
              >
                <span>You finished the course. Get your certificate</span>
                <Award className="size-5" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
        {!focusOn && (
          <aside className="hidden border-l lg:block">
            <div className="sticky top-[7.25rem] max-h-[calc(100svh-7.25rem)] overflow-y-auto p-3">
              {sidebar}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Curriculum({
  course,
  lessonId,
  quizModule,
  cardsModule,
  labsModule,
  onNavigate,
}: {
  course: Course;
  lessonId?: string;
  quizModule?: string;
  cardsModule?: string;
  labsModule?: string;
  onNavigate: () => void;
}) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  return (
    <nav aria-label="Course content" className="space-y-5">
      {course.modules.map((m, mi) => {
        const st = unitStatus(course, m, { completed, quizzes });
        return (
          <section key={m.id} aria-labelledby={`cu-${m.id}`}>
            <div className="flex items-start gap-2 px-2 pb-1.5">
              <MasteryIcon level={st.level} className="mt-0.5" />
              <h3 id={`cu-${m.id}`} className="text-base leading-snug font-semibold">
                Unit {mi + 1}: {m.title}
              </h3>
            </div>
            <ul className="space-y-0.5">
              {m.lessons.map((l) => {
                const active = l.id === lessonId;
                return (
                  <li key={l.id}>
                    <Link
                      to={`/learn/${course.slug}/${l.id}`}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-muted",
                        active && "bg-accent font-medium ring-1 ring-primary/30",
                      )}
                    >
                      <LessonStateIcon
                        done={!!completed[`${course.slug}/${l.id}`]}
                        active={active}
                      />
                      <span className="flex-1 leading-snug">
                        {l.title}
                        <span className="mt-0.5 flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                          {l.videos?.length ? (
                            <PlayCircle className="size-3.5" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          {minutes(l.minutes)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {unitLabs(m).length > 0 && (
                <li>
                  <Link
                    to={`/learn/${course.slug}/labs/${m.id}`}
                    onClick={onNavigate}
                    aria-current={labsModule === m.id ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted",
                      labsModule === m.id && "bg-accent font-medium ring-1 ring-primary/30",
                    )}
                  >
                    <FlaskConical className="size-5 shrink-0 text-muted-foreground/70" />
                    Labs
                    <Badge variant="secondary" className="ml-auto">
                      {unitLabs(m).length}
                    </Badge>
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to={`/learn/${course.slug}/cards/${m.id}`}
                  onClick={onNavigate}
                  aria-current={cardsModule === m.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted",
                    cardsModule === m.id && "bg-accent font-medium ring-1 ring-primary/30",
                  )}
                >
                  <Layers className="size-5 shrink-0 text-muted-foreground/70" />
                  Flashcards
                </Link>
              </li>
              <li>
                <Link
                  to={`/learn/${course.slug}/quiz/${m.id}`}
                  onClick={onNavigate}
                  aria-current={quizModule === m.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted",
                    quizModule === m.id && "bg-accent font-medium ring-1 ring-primary/30",
                  )}
                >
                  {st.quiz?.passed ? (
                    <CheckCircle2 className="size-5 shrink-0 text-m-proficient" />
                  ) : (
                    <ClipboardCheck className="size-5 shrink-0 text-muted-foreground/70" />
                  )}
                  Unit quiz
                  {st.quiz && (
                    <Badge variant="secondary" className="ml-auto">
                      {Math.round(st.quiz.best * 100)}%
                    </Badge>
                  )}
                </Link>
              </li>
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function LessonView({
  course,
  lesson,
  moduleTitle,
  moduleId,
}: {
  course: Course;
  lesson: Lesson;
  moduleTitle: string;
  moduleId: string;
}) {
  const key = `${course.slug}/${lesson.id}`;
  const done = useStore((s) => !!s.completed[key]);
  const marked = useStore((s) => !!s.bookmarks[key]);
  const notes = useStore((s) => s.notes[key] ?? "");
  const files = useAttachments(course.slug, lesson.id);
  const hasNote = notes.trim().length > 0;
  const wide = useStore((s) => s.focusMode) && !!lesson.videos?.length;
  return (
    <article
      data-focus={wide || undefined}
      className={cn("mx-auto space-y-6", wide ? "max-w-none" : "max-w-4xl")}
    >
      <header className={cn("space-y-2", wide && "mx-auto w-full max-w-3xl")}>
        <div className="text-sm text-muted-foreground">{moduleTitle}</div>
        <h1 className="text-3xl font-bold tracking-tight text-balance">{lesson.title}</h1>
        <p className="text-muted-foreground">{lesson.summary}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={done ? "secondary" : "default"}
            onClick={() => {
              actions.toggleComplete(course.slug, lesson.id);
              if (!done) toast.success("Lesson marked complete");
            }}
          >
            {done ? <CheckCircle2 className="text-success" /> : <Check />}{" "}
            {done ? "Completed" : "Mark complete"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.toggleBookmark(course.slug, lesson.id)}
          >
            {marked ? <BookmarkCheck /> : <Bookmark />} {marked ? "Bookmarked" : "Bookmark"}
          </Button>
          <span className="text-xs text-muted-foreground">{minutes(lesson.minutes)}</span>
        </div>
      </header>

      {lesson.videos?.map((v) => (
        <YouTubeEmbed key={v.id} video={v} />
      ))}

      <Tabs defaultValue="lesson" className={cn(wide && "mx-auto w-full max-w-3xl")}>
        <TabsList variant="line" className="w-fit justify-start">
          <TabsTrigger value="lesson">
            <FileText className="size-4" /> Lesson
          </TabsTrigger>
          <TabsTrigger value="notes">
            <NotebookPen className="size-4" /> Notes
            {hasNote && <span className="size-1.5 rounded-full bg-gold" />}
          </TabsTrigger>
          <TabsTrigger value="files">
            <Paperclip className="size-4" /> Files
            {files.length > 0 && <Badge variant="secondary">{files.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="refs">References</TabsTrigger>
        </TabsList>
        <TabsContent value="lesson" className="pt-4">
          <Blocks
            blocks={lesson.blocks}
            labHref={(id) => `/learn/${course.slug}/labs/${moduleId}?lab=${id}`}
          />
          <section className="mt-8 rounded-xl border border-primary/30 bg-accent p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <ListChecks className="size-4" /> Key takeaways
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {lesson.takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          <Suspense fallback={<p className="text-muted-foreground">Loading editor…</p>}>
            <NotesEditor course={course} lesson={lesson} />
          </Suspense>
        </TabsContent>
        <TabsContent value="files" className="pt-4">
          <LessonFiles course={course.slug} lesson={lesson.id} />
        </TabsContent>
        <TabsContent value="refs" className="pt-4">
          {lesson.refs?.length ? (
            <ul className="divide-y rounded-xl border">
              {lesson.refs.map((r) => (
                <li key={r.title} className="flex items-start justify-between gap-3 p-4 text-sm">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-muted-foreground">
                      {r.org}
                      {r.note ? ` · ${r.note}` : ""}
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
          ) : (
            <p className="text-sm text-muted-foreground">
              No lesson-specific references. See the course reading list.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}

function LabsView({ course, moduleId }: { course: Course; moduleId: string }) {
  const m = course.modules.find((x) => x.id === moduleId)!;
  const ids = unitLabs(m);
  const [params, setParams] = useSearchParams();
  const active = ids.includes(params.get("lab") ?? "") ? params.get("lab")! : ids[0];
  const Lab = LAB_REGISTRY[active].component;
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">{m.title}</div>
        <h1 className="text-3xl font-semibold">Labs</h1>
        <p className="text-muted-foreground">
          Interactive models for this unit. Change the numbers and watch what moves. Everything runs
          in your browser.
        </p>
      </header>
      {ids.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Labs in this unit">
          {ids.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === active}
              onClick={() => setParams({ lab: id }, { replace: true })}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-1.5 font-medium transition-colors",
                id === active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {LAB_REGISTRY[id].title}
            </button>
          ))}
        </div>
      )}
      <Lab key={active} />
    </section>
  );
}

function CardsView({ course, moduleId }: { course: Course; moduleId: string }) {
  const m = course.modules.find((x) => x.id === moduleId)!;
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">{m.title}</div>
        <h1 className="text-3xl font-semibold">Flashcards</h1>
        <p className="text-muted-foreground">
          Key terms from this unit, scheduled so the ones you miss come back sooner.
        </p>
      </header>
      <FlashDeck key={moduleId} course={course} moduleId={moduleId} />
    </section>
  );
}

function QuizView({ course, moduleId }: { course: Course; moduleId: string }) {
  const m = course.modules.find((x) => x.id === moduleId)!;
  const q = useStore((s) => s.quizzes[`${course.slug}/${moduleId}`]);
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">{m.title}</div>
        <h1 className="text-3xl font-bold tracking-tight">Module quiz</h1>
        <p className="text-muted-foreground">
          {m.quiz.length} questions · pass mark {QUIZ_PASS * 100}% · unlimited retakes.
        </p>
        {q && (
          <p className="text-sm">
            Best score <strong>{Math.round(q.best * 100)}%</strong> over {q.attempts} attempt
            {q.attempts > 1 ? "s" : ""}{" "}
            {q.passed && (
              <Badge variant="secondary" className="ml-1 bg-success/15 text-success">
                Passed
              </Badge>
            )}
          </p>
        )}
      </header>
      <Quiz
        key={moduleId}
        questions={m.quiz}
        onFinish={(s) => {
          actions.recordQuiz(course.slug, moduleId, s, QUIZ_PASS);
          if (s >= QUIZ_PASS) toast.success(`Passed with ${Math.round(s * 100)}%`);
        }}
      />
    </section>
  );
}
