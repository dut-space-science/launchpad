import { useState } from "react";
import { Check, Circle } from "lucide-react";
import type { Course } from "@/data/types";
import { LEVELS, courseMastery, levelInfo, unitStatus, type Level } from "@/lib/mastery";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";

/** Pie-style mastery icon. The filled fraction (and a shape change at the ends) carries level, not hue alone. */
export function MasteryIcon({ level, className }: { level: Level; className?: string }) {
  const info = levelInfo(level);
  const r = 9;
  const a = info.fraction * Math.PI * 2;
  const x = 12 + r * Math.sin(a);
  const y = 12 - r * Math.cos(a);
  const large = info.fraction > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 shrink-0", className)} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="var(--card)"
        stroke={level === "none" ? "var(--muted-foreground)" : info.color}
        strokeWidth="2"
        strokeOpacity={level === "none" ? 0.5 : 1}
      />
      {level !== "none" && level !== "mastered" && (
        <path d={`M12 12 L12 ${12 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill={info.color} />
      )}
      {level === "mastered" && <circle cx="12" cy="12" r={r} fill={info.color} />}
      {level === "mastered" && (
        <path
          d="M12 7.2l1.4 3 3.3.4-2.4 2.3.6 3.2-2.9-1.6-2.9 1.6.6-3.2-2.4-2.3 3.3-.4z"
          fill="var(--gold)"
        />
      )}
    </svg>
  );
}

export function MasteryBadge({ level, className }: { level: Level; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}
      title={levelInfo(level).hint}
    >
      <MasteryIcon level={level} /> {levelInfo(level).label}
    </span>
  );
}

/** One segment per lesson plus a wider one for the unit quiz. Thin segmented bar: 8px, 2px surface gaps, no text. */
export function UnitLadder({
  course,
  moduleId,
  nextId,
  className,
}: {
  course: Course;
  moduleId: string;
  nextId?: string;
  className?: string;
}) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const m = course.modules.find((x) => x.id === moduleId)!;
  const st = unitStatus(course, m, { completed, quizzes });
  const color = levelInfo(st.level === "none" ? "attempted" : st.level).color;
  return (
    <div
      className={cn("flex gap-0.5", className)}
      role="img"
      aria-label={`${st.doneCount} of ${st.lessons.length} lessons finished, quiz ${st.quiz?.passed ? "passed" : "not passed"}`}
    >
      {st.lessons.map((l) => (
        <span
          key={l.id}
          className={cn(
            "h-2 flex-1 first:rounded-l-full",
            "bg-m-none",
            l.id === nextId && "ring-2 ring-gold ring-offset-1 ring-offset-card",
          )}
          style={l.done ? { background: color } : undefined}
        />
      ))}
      <span
        className="h-2 flex-[1.4] rounded-r-full bg-m-none"
        style={st.quiz?.passed ? { background: color } : undefined}
      />
    </div>
  );
}

/** Segmented bar of unit mastery for a whole course. Legend names each level and carries the counts. */
export function CourseMasteryBar({ course }: { course: Course }) {
  const completed = useStore((s) => s.completed);
  const quizzes = useStore((s) => s.quizzes);
  const { counts } = courseMastery(course, { completed, quizzes });
  const total = course.modules.length;
  const [tip, setTip] = useState<Level | null>(null);
  const parts = LEVELS.filter((l) => counts[l.key] > 0);
  return (
    <div className="space-y-3">
      <div
        className="flex h-4 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={LEVELS.map((l) => `${counts[l.key]} units ${l.label.toLowerCase()}`).join(", ")}
      >
        {parts.map((l) => (
          <button
            type="button"
            key={l.key}
            onPointerEnter={() => setTip(l.key)}
            onPointerLeave={() => setTip(null)}
            onFocus={() => setTip(l.key)}
            onBlur={() => setTip(null)}
            className={cn("cursor-default transition-[filter]", tip === l.key && "brightness-110")}
            style={{ flex: counts[l.key], background: l.color }}
            aria-label={`${l.label}: ${counts[l.key]} of ${total} units`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {LEVELS.map((l) => (
          <li
            key={l.key}
            className={cn("flex items-center gap-1.5", tip === l.key && "text-foreground")}
          >
            <MasteryIcon level={l.key} className="size-4" /> {l.label}{" "}
            <span className="font-semibold text-foreground">{counts[l.key]}</span>
          </li>
        ))}
      </ul>
      {tip && (
        <p className="text-sm text-muted-foreground" role="status">
          {counts[tip]} of {total} units: {levelInfo(tip).hint.toLowerCase()}
        </p>
      )}
    </div>
  );
}

export function LessonStateIcon({ done, active }: { done: boolean; active?: boolean }) {
  if (done)
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-m-proficient text-white">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  return (
    <Circle
      className={cn("size-5 shrink-0", active ? "text-gold" : "text-muted-foreground/60")}
      strokeWidth={2}
    />
  );
}
