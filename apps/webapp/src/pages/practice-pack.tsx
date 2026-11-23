import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Eye,
  Lightbulb,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Inline } from "@/components/rich";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getCourse } from "@/data/courses";
import type { Problem } from "@/data/types";
import { KIND_LABEL, allPacks, checkNumeric, problemsFor } from "@/lib/practice";
import { actions } from "@/store/store";
import { NotFound } from "@/pages/not-found";
import { cn } from "@/lib/utils";

type Result = "correct" | "wrong" | "revealed";

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="my-2 leading-relaxed">
          <Inline text={p} />
        </p>
      ))}
    </>
  );
}

export function PracticePack() {
  const { slug, packId } = useParams();
  const course = getCourse(slug);
  const pack = course && allPacks(course).find((p) => p.id === packId);
  if (!course || !pack) return <NotFound />;
  return <Runner key={pack.id} course={course} pack={pack} />;
}

function Runner({
  course,
  pack,
}: {
  course: NonNullable<ReturnType<typeof getCourse>>;
  pack: ReturnType<typeof allPacks>[number];
}) {
  const [run, setRun] = useState(0);
  const problems = useMemo(() => {
    void run;
    return problemsFor(course, pack);
  }, [course, pack, run]);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [done, setDone] = useState(false);

  const record = (id: string, r: Result) => setResults((s) => ({ ...s, [id]: r }));
  const next = () => {
    if (i + 1 < problems.length) return setI(i + 1);
    const score = problems.filter((p) => results[p.id] === "correct").length / problems.length;
    actions.recordPractice(course.slug, pack.id, score);
    setDone(true);
  };
  const restart = (only?: Problem[]) => {
    setResults(
      only
        ? Object.fromEntries(
            Object.entries(results).filter(([id]) => !only.some((p) => p.id === id)),
          )
        : {},
    );
    setI(0);
    setDone(false);
    if (!only) setRun((n) => n + 1);
  };

  if (done) {
    const correct = problems.filter((p) => results[p.id] === "correct");
    const missed = problems.filter((p) => results[p.id] !== "correct");
    const pct = Math.round((correct.length / problems.length) * 100);
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <Link
          to="/practice"
          className="flex items-center gap-1 text-sm font-medium hover:text-primary"
        >
          <ChevronLeft className="size-4" /> Question bank
        </Link>
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">{pack.title}: results</h1>
          <p className="text-muted-foreground">
            {correct.length} of {problems.length} correct.
          </p>
        </header>
        <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
          <div className="font-heading text-5xl font-semibold">{pct}%</div>
          <Progress className="flex-1" value={pct} aria-label="Score" />
        </div>
        <ul className="divide-y rounded-xl border bg-card">
          {problems.map((p, n) => (
            <li key={p.id} className="flex items-start gap-3 p-4">
              {results[p.id] === "correct" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-m-proficient" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground">
                  Question {n + 1}
                  {results[p.id] === "revealed" ? ", solution viewed first" : ""}
                </div>
                <div className="line-clamp-2">
                  <Inline text={p.prompt} />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {missed.length > 0 && (
            <Button
              onClick={() => {
                setRun((n) => n);
                restart(missed);
              }}
            >
              <RotateCcw /> Retry the {missed.length} missed
            </Button>
          )}
          <Button variant="outline" onClick={() => restart()}>
            Start the pack again
          </Button>
          <Link to="/practice" className={buttonVariants({ variant: "outline" })}>
            Back to the bank
          </Link>
        </div>
      </div>
    );
  }

  const active = problems.filter((p) => results[p.id] !== "correct" || problems.indexOf(p) === i);
  const p = i < problems.length ? problems[i] : problems[0];
  void active;
  const unitIdx = course.modules.findIndex((m) => m.id === pack.unit);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <Link
        to="/practice"
        className="flex items-center gap-1 text-sm font-medium hover:text-primary"
      >
        <ChevronLeft className="size-4" /> Question bank
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{KIND_LABEL[pack.kind]}</Badge>
          {unitIdx >= 0 && <Badge variant="outline">Unit {unitIdx + 1}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold">{pack.title}</h1>
        <div className="flex items-center gap-3">
          <Progress
            className="flex-1"
            value={(i / problems.length) * 100}
            aria-label="Pack progress"
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            Question {i + 1} of {problems.length}
          </span>
        </div>
      </header>
      <ProblemCard
        key={`${run}-${p.id}`}
        problem={p}
        onDone={(r) => record(p.id, r)}
        onNext={next}
        last={i + 1 === problems.length}
      />
    </div>
  );
}

function ProblemCard({
  problem: p,
  onDone,
  onNext,
  last,
}: {
  problem: Problem;
  onDone: (r: Result) => void;
  onNext: () => void;
  last: boolean;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"open" | "checked">("open");
  const [outcome, setOutcome] = useState<Result | null>(null);
  const [hint, setHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const finish = (r: Result) => {
    setOutcome(r);
    setState("checked");
    setShowSolution(true);
    onDone(r);
  };
  const check = () => {
    if (p.kind === "mcq") return finish(pick === p.answer ? "correct" : "wrong");
    if (p.kind === "numeric") {
      const c = checkNumeric(text, p);
      if (c === "invalid") return toast.error("Enter a number, for example 10.07 or 1.2e3.");
      finish(c);
    }
  };
  const reveal = () => {
    if (state === "open") {
      setOutcome("revealed");
      onDone("revealed");
      setState("checked");
    }
    setShowSolution(true);
  };
  const canCheck =
    p.kind === "mcq" ? pick !== null : p.kind === "numeric" ? text.trim() !== "" : false;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Question">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {p.kind === "mcq"
            ? "Multiple choice"
            : p.kind === "numeric"
              ? "Numeric answer"
              : "Written answer"}
        </span>
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`Difficulty ${p.difficulty} of 3`}
        >
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                "size-2 rounded-full",
                n <= p.difficulty ? "bg-primary" : "bg-muted-foreground/25",
              )}
            />
          ))}
        </span>
      </div>
      <div className="text-lg leading-relaxed">
        <Paragraphs text={p.prompt} />
      </div>

      {p.kind === "mcq" && (
        <div className="grid gap-2" role="radiogroup" aria-label="Choose an answer">
          {p.options!.map((o, k) => {
            const right = state === "checked" && k === p.answer;
            const wrong = state === "checked" && pick === k && k !== p.answer;
            return (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/60",
                  pick === k && state === "open" && "border-primary bg-primary/5",
                  right && "border-success bg-success/10",
                  wrong && "border-destructive bg-destructive/10",
                  state === "checked" && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name="opt"
                  className="mt-1 accent-[var(--primary)]"
                  disabled={state === "checked"}
                  checked={pick === k}
                  onChange={() => setPick(k)}
                />
                <span className="flex-1">
                  <Inline text={o} />
                </span>
              </label>
            );
          })}
        </div>
      )}

      {p.kind === "numeric" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (state === "open") check();
          }}
        >
          <Input
            className="h-11 w-48 text-base"
            inputMode="decimal"
            placeholder="Your answer"
            value={text}
            disabled={state === "checked"}
            onChange={(e) => setText(e.target.value)}
            aria-label="Your answer"
          />
          {p.numeric!.unit && <span className="text-muted-foreground">{p.numeric!.unit}</span>}
          <span className="text-sm text-muted-foreground">
            Within {Math.round(p.numeric!.tolerance * 100)}% counts as correct.
          </span>
        </form>
      )}

      {p.kind === "written" && (
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your answer here, then compare with the solution."
          aria-label="Your answer"
          disabled={state === "checked"}
        />
      )}

      {hint && p.hint && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
          <span className="font-semibold">Hint: </span>
          <Inline text={p.hint} />
        </p>
      )}

      {outcome && p.kind !== "written" && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 font-medium",
            outcome === "correct"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {outcome === "correct" ? (
            <>
              <CheckCircle2 className="size-5" /> Correct
            </>
          ) : (
            <>
              <XCircle className="size-5" />{" "}
              {outcome === "revealed" ? "Solution shown" : "Not quite"}
              {p.kind === "numeric" && p.numeric
                ? `. The answer is ${p.numeric.value} ${p.numeric.unit}`
                : ""}
            </>
          )}
        </p>
      )}

      {showSolution && (
        <div className="rounded-lg bg-muted/60 p-4">
          <div className="mb-1 font-semibold">Solution</div>
          <Paragraphs text={p.solution} />
        </div>
      )}

      {p.kind === "written" &&
        showSolution &&
        !outcome?.startsWith("c") &&
        state === "checked" &&
        outcome === "revealed" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">How did your answer compare?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOutcome("correct");
                onDone("correct");
              }}
            >
              <CheckCircle2 /> I had it
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOutcome("wrong");
                onDone("wrong");
              }}
            >
              <XCircle /> I missed it
            </Button>
          </div>
        )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {state === "open" && p.kind !== "written" && (
          <Button onClick={check} disabled={!canCheck}>
            Check answer
          </Button>
        )}
        {state === "open" && p.hint && !hint && (
          <Button variant="outline" onClick={() => setHint(true)}>
            <Lightbulb /> Hint
          </Button>
        )}
        {state === "open" && (
          <Button variant={p.kind === "written" ? "default" : "ghost"} onClick={reveal}>
            <Eye /> Show solution
          </Button>
        )}
        {state === "checked" &&
          (p.kind !== "written" || outcome === "correct" || outcome === "wrong") && (
            <Button className="ml-auto" onClick={onNext}>
              {last ? "See results" : "Next question"} <ArrowRight />
            </Button>
          )}
      </div>
    </section>
  );
}
