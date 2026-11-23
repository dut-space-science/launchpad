export { CourseArt } from "@/components/course-art";
import { Link } from "react-router-dom";
import { BookOpen, Clock, FlaskConical } from "lucide-react";
import type { Course } from "@/data/types";
import { courseMinutes, lessonCount } from "@/data/courses";
import { Badge } from "@/components/ui/badge";
import { useCourseProgress } from "@/lib/progress";
import { useStore } from "@/store/store";
import { fieldOfDiscipline } from "@/data/taxonomy";
import { minutes } from "@/lib/format";
import { stats } from "@/lib/catalog";
import { CourseArt } from "@/components/course-art";

export function CourseCard({ course }: { course: Course }) {
  const p = useCourseProgress(course);
  const enrolled = useStore((s) => !!s.enrolled[course.slug]);
  const { labs } = stats(course);
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50 dark:hover:border-gold/60"
    >
      <CourseArt course={course} className="aspect-[2/1]" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
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
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{p.complete ? "Complete" : "In progress"}</span>
              <span className="text-muted-foreground tabular-nums">{p.pct}%</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-m-none"
              role="progressbar"
              aria-valuenow={p.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${course.title} progress`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
