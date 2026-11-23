import { Link } from "react-router-dom";
import { BookOpen, Clock, FlaskConical } from "lucide-react";
import type { Course } from "@/data/types";
import { courseMinutes, lessonCount } from "@/data/courses";
import { MasteryBadge } from "@/components/mastery";
import { Badge } from "@/components/ui/badge";
import { courseMastery } from "@/lib/mastery";
import { useCourseProgress } from "@/lib/progress";
import { useStore } from "@/store/store";
import { fieldOfDiscipline } from "@/data/taxonomy";
import { minutes } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Generated cover art: orbital rings tinted by the course hue. No image assets needed. */
export function CourseArt({
  course,
  className = "",
}: {
  course: Pick<Course, "hue" | "title">;
  className?: string;
}) {
  const h = course.hue;
  return (
    <svg
      viewBox="0 0 400 200"
      className={cn("w-full", className)}
      role="img"
      aria-label={`${course.title} cover`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`g${h}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`oklch(0.28 0.1 ${h})`} />
          <stop offset="1" stopColor={`oklch(0.18 0.06 ${h + 20})`} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#g${h})`} />
      {[40, 70, 100, 140].map((r, i) => (
        <ellipse
          key={r}
          cx="290"
          cy="110"
          rx={r * 1.6}
          ry={r * 0.55}
          transform="rotate(-22 290 110)"
          fill="none"
          stroke="#5ec184"
          strokeOpacity={0.18 + i * 0.1}
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M0 150 Q 50 110 100 150 T 200 150 T 300 150 T 400 150"
        fill="none"
        stroke="#5ec184"
        strokeWidth="2.5"
      />
      <path
        d="M0 150 Q 50 90 100 150 T 200 150 T 300 150 T 400 150"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle cx="318" cy="68" r="6" fill="#a5dbbb" />
    </svg>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const p = useCourseProgress(course);
  const enrolled = useStore((s) => !!s.enrolled[course.slug]);
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const { counts } = courseMastery(course, { completed, quizzes });
  const labs = course.modules
    .flatMap((m) => m.lessons)
    .flatMap((l) => l.blocks)
    .filter((b) => b.t === "lab").length;
  const top = counts.mastered
    ? "mastered"
    : counts.proficient
      ? "proficient"
      : counts.familiar
        ? "familiar"
        : counts.attempted
          ? "attempted"
          : "none";
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50 dark:hover:border-gold/60"
    >
      <CourseArt course={course} className="h-36 object-cover" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{fieldOfDiscipline(course.discipline)?.name}</Badge>
          <Badge variant="outline">{course.level}</Badge>
        </div>
        <h3 className="text-xl leading-snug font-semibold group-hover:text-primary">
          {course.title}
        </h3>
        <p className="line-clamp-2 text-muted-foreground">{course.subtitle}</p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" /> {lessonCount(course)} lessons
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical className="size-4" /> {labs} labs
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {minutes(courseMinutes(course))}
          </span>
        </div>
        {enrolled && (
          <div className="flex items-center justify-between border-t pt-3">
            <MasteryBadge level={top} />
            <span className="text-sm text-muted-foreground">{p.pct}% done</span>
          </div>
        )}
      </div>
    </Link>
  );
}
