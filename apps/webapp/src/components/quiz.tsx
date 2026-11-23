import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { Question } from "@/data/types";
import { QUIZ_PASS } from "@/data/courses";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Inline } from "@/components/rich";

export function Quiz({
  questions,
  onFinish,
}: {
  questions: Question[];
  onFinish: (score: number) => void;
}) {
  // Shuffle option order per attempt so retakes are not just memorisation of position.
  const [attempt, setAttempt] = useState(0);
  const shuffled = useMemo(
    () =>
      questions.map((q) => {
        void attempt;
        const order = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
        return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
      }),
    [questions, attempt],
  );
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [checked, setChecked] = useState(false);

  const done = picked.filter((p) => p !== null).length;
  const score = shuffled.filter((q, i) => picked[i] === q.answer).length / shuffled.length;

  function submit() {
    setChecked(true);
    onFinish(score);
  }
  function retry() {
    setAttempt((a) => a + 1);
    setPicked(questions.map(() => null));
    setChecked(false);
  }

  return (
    <div className="space-y-6">
      <Progress value={(done / shuffled.length) * 100} aria-label="Quiz progress" />
      {shuffled.map((q, qi) => (
        <fieldset key={qi} className="space-y-3 rounded-xl border bg-card p-5">
          <legend className="px-1 text-base font-semibold">
            <span className="mr-2 text-muted-foreground">{qi + 1}.</span>
            <Inline text={q.q} />
          </legend>
          <div className="grid gap-2">
            {q.options.map((o, oi) => {
              const sel = picked[qi] === oi;
              const right = checked && oi === q.answer;
              const wrong = checked && sel && oi !== q.answer;
              return (
                <label
                  key={oi}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                    sel && !checked && "border-primary bg-primary/5",
                    right && "border-success bg-success/10",
                    wrong && "border-destructive bg-destructive/10",
                    checked && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name={`q${qi}`}
                    className="mt-1 accent-[var(--primary)]"
                    disabled={checked}
                    checked={sel}
                    onChange={() => setPicked((p) => p.map((v, i) => (i === qi ? oi : v)))}
                  />
                  <span className="flex-1">{o}</span>
                  {right && <CheckCircle2 className="size-4 text-success" />}
                  {wrong && <XCircle className="size-4 text-destructive" />}
                </label>
              );
            })}
          </div>
          {checked && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm">
              <span className="font-semibold">
                {picked[qi] === q.answer ? "Correct. " : "Not quite. "}
              </span>
              {q.why}
            </p>
          )}
        </fieldset>
      ))}
      {!checked ? (
        <Button size="lg" onClick={submit} disabled={done < shuffled.length}>
          Submit answers ({done}/{shuffled.length})
        </Button>
      ) : (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5",
            score >= QUIZ_PASS
              ? "border-success bg-success/10"
              : "border-destructive bg-destructive/10",
          )}
        >
          <div>
            <div className="text-2xl font-bold">{Math.round(score * 100)}%</div>
            <div className="text-sm">
              {score >= QUIZ_PASS
                ? "Passed. Nice work."
                : `Pass mark is ${QUIZ_PASS * 100}%. Review the explanations and try again.`}
            </div>
          </div>
          <Button variant="outline" onClick={retry}>
            <RotateCcw /> Retake quiz
          </Button>
        </div>
      )}
    </div>
  );
}
