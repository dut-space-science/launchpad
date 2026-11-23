import { Link } from "react-router-dom";
import { ArrowRight, FileText, PlayCircle, Rocket } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { MasteryBadge, UnitLadder } from "@/components/mastery";
import { buttonVariants } from "@/components/ui/button";
import { courses, findLesson, getCourse, lessonsOf } from "@/data/courses";
import { unitStatus } from "@/lib/mastery";
import { minutes } from "@/lib/format";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

const HERO_BTN = "h-11 bg-[#3fb06a] px-5 text-base text-[#07170d] hover:bg-[#4bc079]";
const HERO_BTN_OUTLINE =
  "h-11 border-white/30 bg-transparent px-5 text-base text-white hover:bg-white/10 hover:text-white";

/** Decorative orbits in brand greens. Pure SVG, no assets. */
function OrbitArt() {
  return (
    <svg viewBox="0 0 520 360" className="hidden h-auto w-full max-w-xl lg:block" aria-hidden>
      {[55, 95, 140, 185].map((r, i) => (
        <ellipse
          key={r}
          cx="270"
          cy="190"
          rx={r * 1.45}
          ry={r * 0.52}
          transform="rotate(-20 270 190)"
          fill="none"
          stroke="#6fcf97"
          strokeOpacity={0.22 + i * 0.12}
          strokeWidth="1.5"
        />
      ))}
      <circle cx="270" cy="190" r="34" fill="#1e8443" />
      <circle
        cx="270"
        cy="190"
        r="34"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M252 196c10-18 26-24 36-20"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="402" cy="112" r="8" fill="#a5dbbb" />
      <circle cx="132" cy="236" r="5" fill="#fff" fillOpacity="0.85" />
      <circle cx="338" cy="296" r="6" fill="#3fb06a" />
    </svg>
  );
}

/** Shown when the learner has studied something: resume it, with a preview of where they were. */
function ResumeHero({ courseSlug, lessonId }: { courseSlug: string; lessonId: string }) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const course = getCourse(courseSlug)!;
  const { lesson, module: unit } = findLesson(course, lessonId)!;
  const unitIndex = course.modules.findIndex((m) => m.id === unit.id);
  const lessonIndex = unit.lessons.findIndex((l) => l.id === lesson.id);
  const flat = lessonsOf(course);
  const at = flat.findIndex((x) => x.id === lesson.id);
  const next = flat.find((l, i) => i > at && !completed[`${course.slug}/${l.id}`]);
  const done = !!completed[`${course.slug}/${lesson.id}`];
  const st = unitStatus(course, unit, { completed, quizzes });
  const video = lesson.videos?.[0];
  const href = `/learn/${course.slug}/${lesson.id}`;

  return (
    <section className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 md:py-16 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="text-white/70">{course.title}</p>
          <h1 className="max-w-xl text-4xl leading-[1.12] font-semibold text-balance md:text-5xl">
            <span className="mb-2 block text-lg font-normal text-[#a5dbbb]">
              {done ? "You finished" : "Pick up where you left off"}
            </span>
            {lesson.title}
          </h1>
          <p className="max-w-lg text-lg text-white/80">{lesson.summary}</p>
          <div className="flex flex-wrap gap-3">
            <Link to={href} className={cn(buttonVariants({ size: "lg" }), HERO_BTN)}>
              <PlayCircle /> {done ? "Review lesson" : "Continue lesson"}
            </Link>
            {next && done && (
              <Link
                to={`/learn/${course.slug}/${next.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), HERO_BTN_OUTLINE)}
              >
                Next: {next.title} <ArrowRight />
              </Link>
            )}
            <Link
              to={`/courses/${course.slug}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), HERO_BTN_OUTLINE)}
            >
              Go to the course
            </Link>
          </div>
        </div>

        <Link
          to={href}
          className="group block overflow-hidden rounded-2xl border border-white/15 bg-card text-card-foreground transition-colors hover:border-white/40"
          aria-label={`Preview: ${lesson.title}`}
        >
          {video ? (
            <div className="relative aspect-video bg-black">
              <img
                src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                alt=""
                className="size-full object-cover opacity-85 transition group-hover:opacity-100"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-full bg-[#3fb06a] text-[#07170d] shadow-lg transition group-hover:scale-110">
                  <PlayCircle className="size-7" />
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-b bg-muted/60 px-5 py-4">
              <FileText className="size-5 text-primary" />
              <span className="font-medium">Reading lesson, {minutes(lesson.minutes)}</span>
            </div>
          )}
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                Unit {unitIndex + 1}: {unit.title}
              </span>
              <MasteryBadge level={st.level} />
            </div>
            <UnitLadder course={course} moduleId={unit.id} nextId={done ? next?.id : lesson.id} />
            <p className="text-sm text-muted-foreground">
              Lesson {lessonIndex + 1} of {unit.lessons.length}, {minutes(lesson.minutes)}.{" "}
              {st.doneCount} of {unit.lessons.length} finished in this unit.
            </p>
            <div>
              <h2 className="mb-1.5 text-base font-semibold">Key points</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {lesson.takeaways.slice(0, 3).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

function GenericHero() {
  return (
    <section className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:py-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <h1 className="max-w-xl text-4xl leading-[1.12] font-semibold text-balance md:text-5xl">
            Learn space science and engineering
          </h1>
          <p className="max-w-lg text-lg text-white/80">
            Courses, hands-on labs and quick checks from the DUT Space Science Centre. Learn at your
            own pace, in your browser.
          </p>
          <Link to="/courses" className={cn(buttonVariants({ size: "lg" }), HERO_BTN)}>
            Explore courses <ArrowRight />
          </Link>
        </div>
        <OrbitArt />
      </div>
    </section>
  );
}

export function Home() {
  const last = useStore((s) => s.last);
  const lastCourse = last ? getCourse(last.course) : undefined;
  const resumable = last && lastCourse && findLesson(lastCourse, last.lesson);
  return (
    <>
      {resumable && last ? (
        <ResumeHero courseSlug={last.course} lessonId={last.lesson} />
      ) : (
        <GenericHero />
      )}

      <section id="courses" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14">
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold">Courses</h2>
            <Link to="/courses" className="font-medium text-primary hover:text-primary">
              Browse all courses
            </Link>
          </div>
          <p className="text-muted-foreground">
            Each course is split into units. Finish a unit's lessons and pass its quiz to master it.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.slug} course={c} />
          ))}
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-dashed p-6 text-muted-foreground">
            <Rocket className="size-7" />
            <div className="font-semibold text-foreground">More courses are coming</div>
            <p className="text-sm">
              Navigation, satellite communications, the space segment and research skills.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
