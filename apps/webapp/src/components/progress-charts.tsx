import { useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Course } from "@/data/types";
import { QUIZ_PASS } from "@/data/courses";
import { dayKey, fmtDate, mondayIndex } from "@/lib/format";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

/**
 * Charts for the learner's own progress. One hue (the brand green) throughout: magnitude is a light-to-strong
 * ramp of it, and "not yet" is a lighter step of the same ramp rather than another colour.
 */

/** Sequential steps of the primary hue, mixed into the card surface. Level 0 is "nothing", one step off the card. */
const STEP = [
  "color-mix(in srgb, var(--foreground) 8%, var(--card))",
  "color-mix(in srgb, var(--primary) 36%, var(--card))",
  "color-mix(in srgb, var(--primary) 58%, var(--card))",
  "color-mix(in srgb, var(--primary) 80%, var(--card))",
  "var(--primary)",
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Study activity: one column per week, one row per weekday, four quantised levels of the green ramp. */
export function ActivityHeatmap({
  activity,
  maxWeeks = 52,
}: {
  activity: Record<string, number>;
  /** The most weeks to show: a year. Fewer are shown when the space is narrower. */
  maxWeeks?: number;
}) {
  const LABEL = 32; // the weekday-label column, in px
  const GAP = 3;
  const MIN_CELL = 12;
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Fit to the space: as many weeks as keep every square at least MIN_CELL wide, up to a year, then the squares share
  // whatever width is left. So the chart fills its card on a wide screen and shows fewer weeks (not a scrollbar) on a phone.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const weeks = width
    ? Math.max(8, Math.min(maxWeeks, Math.floor((width - LABEL) / (MIN_CELL + GAP))))
    : 26;

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - mondayIndex(today) - (weeks - 1) * 7); // columns are weeks, Monday first
  const cols = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      return day > today ? null : { day, n: activity[dayKey(day)] ?? 0 };
    }),
  );
  const cells = cols.flat().filter((c) => c !== null);
  const max = Math.max(1, ...cells.map((c) => c.n));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const activeDays = cells.filter((c) => c.n > 0).length;
  const total = cells.reduce((a, c) => a + c.n, 0);

  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const describe = (c: { day: Date; n: number }) =>
    `${fmtDate(c.day, { weekday: "short", day: "numeric", month: "short" })}: ${
      c.n === 0 ? "no study" : plural(c.n, "action")
    }`;
  // A month is labelled above the week it starts in; a partial first month only if it has room before the next label.
  const starts = cols.map(
    (c, w) => w > 0 && c[0] !== null && cols[w - 1][0]?.day.getMonth() !== c[0].day.getMonth(),
  );
  const month = (w: number) => {
    const first = cols[w][0]?.day;
    const show = starts[w] || (w === 0 && !starts.slice(1, 4).some(Boolean));
    return first && show ? fmtDate(first, { month: "short" }) : "";
  };
  const showTip = (el: HTMLElement, c: { day: Date; n: number }) =>
    setTip({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop, text: describe(c) });

  return (
    <figure className="space-y-3">
      <figcaption className="text-sm text-muted-foreground">
        {plural(activeDays, "active day")} and {plural(total, "action")} in the last {weeks} weeks
      </figcaption>
      <div ref={box} className="relative" onPointerLeave={() => setTip(null)}>
        <div
          className="grid w-full text-xs text-muted-foreground"
          style={{
            gridTemplateColumns: `${LABEL}px repeat(${weeks}, minmax(0, 1fr))`,
            gridTemplateRows: "1.25rem",
            gap: GAP,
          }}
        >
          <span />
          {cols.map((_, w) => (
            <span key={w} className="overflow-visible whitespace-nowrap">
              {month(w)}
            </span>
          ))}
          {Array.from({ length: 7 }, (_, d) => (
            <div key={d} className="contents">
              <span
                className="flex items-center"
                style={{ gridColumn: 1, gridRow: d + 2 }}
                aria-hidden
              >
                {["Mon", "", "Wed", "", "Fri", "", ""][d]}
              </span>
              {cols.map((col, w) => {
                const c = col[d];
                return c ? (
                  <button
                    type="button"
                    key={w}
                    aria-label={describe(c)}
                    style={{ gridColumn: w + 2, gridRow: d + 2, background: STEP[level(c.n)] }}
                    className="aspect-square w-full cursor-default rounded-[3px] focus-visible:outline-2"
                    onPointerEnter={(e) => showTip(e.currentTarget, c)}
                    onFocus={(e) => showTip(e.currentTarget, c)}
                    onBlur={() => setTip(null)}
                  />
                ) : (
                  <span key={w} style={{ gridColumn: w + 2, gridRow: d + 2 }} />
                );
              })}
            </div>
          ))}
        </div>
        {tip && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1 text-sm whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: tip.x, top: tip.y - 6 }}
          >
            {tip.text}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
        Less
        {STEP.map((bg) => (
          <span key={bg} className="size-3.5 rounded-[3px]" style={{ background: bg }} />
        ))}
        More
      </div>
    </figure>
  );
}

/** Best quiz score per unit: horizontal bars from one baseline, with the pass mark as a labelled reference line. */
export function QuizScores({ course }: { course: Course }) {
  const quizzes = useStore((s) => s.quizzes);
  const pass = QUIZ_PASS * 100;
  return (
    <figure className="space-y-1">
      <div className="grid grid-cols-[minmax(0,13rem)_1fr_4.5rem] gap-x-4 text-xs text-muted-foreground">
        <span />
        <span className="relative h-4">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${pass}%` }}
          >
            Pass {pass}%
          </span>
        </span>
      </div>
      {course.modules.map((m, i) => {
        const q = quizzes[`${course.slug}/${m.id}`];
        const pct = q ? Math.round(q.best * 100) : 0;
        const label = q
          ? `Unit ${i + 1}, ${m.title}: best ${pct}%${q.passed ? ", passed" : ", not passed yet"}, ${plural(q.attempts, "attempt")}`
          : `Unit ${i + 1}, ${m.title}: not taken`;
        return (
          <div
            key={m.id}
            className="group grid grid-cols-[minmax(0,13rem)_1fr_4.5rem] items-center gap-x-4 py-1 text-sm"
            title={label}
          >
            <span className="truncate text-muted-foreground group-hover:text-foreground">
              <span className="text-foreground tabular-nums">{i + 1}</span> {m.title}
            </span>
            <span className="relative h-6" role="img" aria-label={label}>
              <span className="absolute inset-y-0 left-0 w-px bg-border" />
              {q && (
                <span
                  className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    background: q.passed ? STEP[4] : STEP[2],
                  }}
                />
              )}
              <span
                className="absolute inset-y-0 w-0 border-l border-dashed border-foreground/45"
                style={{ left: `${pass}%` }}
              />
            </span>
            <span
              className={cn(
                "flex items-center justify-end gap-1 tabular-nums",
                q ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {q?.passed && <Check className="size-3.5 text-primary" aria-hidden />}
              {q ? `${pct}%` : "Not taken"}
            </span>
          </div>
        );
      })}
    </figure>
  );
}

/** A 14-day strip of study actions: the trend beside the streak figure. Today is the accent. */
export function ActivitySpark({
  activity,
  days = 14,
}: {
  activity: Record<string, number>;
  days?: number;
}) {
  const vals = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return activity[dayKey(d)] ?? 0;
  });
  const max = Math.max(1, ...vals);
  return (
    <span className="flex h-7 items-end gap-[2px]" aria-hidden>
      {vals.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-t-[2px]"
          style={{
            height: v ? `${Math.max(15, (v / max) * 100)}%` : 2,
            background: v ? (i === days - 1 ? STEP[4] : STEP[2]) : STEP[0],
          }}
        />
      ))}
    </span>
  );
}
