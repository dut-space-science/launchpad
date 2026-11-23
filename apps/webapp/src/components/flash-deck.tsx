import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { Course } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { actions, useStore } from "@/store/store";
import { Inline } from "@/components/rich";

/** Spaced-repetition deck (Leitner boxes) for one unit's glossary terms. */
export function FlashDeck({ course, moduleId }: { course: Course; moduleId: string }) {
  const cards = useStore((s) => s.cards);
  const terms = useMemo(
    () => course.glossary.filter((g) => g.unit === moduleId),
    [course, moduleId],
  );
  const [session, setSession] = useState(0);
  const [flip, setFlip] = useState(false);
  const [seen, setSeen] = useState(0);
  // The queue is frozen per session so grading a card does not reshuffle what comes next.
  const queue = useMemo(() => {
    void session;
    const now = Date.now();
    return terms
      .filter((c) => (cards[`${course.slug}/${c.term}`]?.due ?? 0) <= now)
      .sort(
        (a, b) =>
          (cards[`${course.slug}/${a.term}`]?.box ?? -1) -
            (cards[`${course.slug}/${b.term}`]?.box ?? -1) || Math.random() - 0.5,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, terms]);
  const card = queue[seen];
  const mastered = terms.filter((t) => (cards[`${course.slug}/${t.term}`]?.box ?? 0) >= 3).length;

  function grade(ok: boolean) {
    actions.gradeCard(course.slug, card.term, ok);
    setFlip(false);
    setSeen((n) => n + 1);
  }

  if (terms.length === 0)
    return <p className="text-muted-foreground">This unit has no flashcards yet.</p>;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Progress
          className="flex-1"
          value={(mastered / terms.length) * 100}
          aria-label="Cards mastered"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {mastered} of {terms.length} mastered
        </span>
      </div>
      {card ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Card {seen + 1} of {queue.length}
          </p>
          <button
            type="button"
            onClick={() => setFlip((f) => !f)}
            className="block min-h-60 w-full cursor-pointer rounded-xl border bg-card p-8 text-center transition-colors hover:border-primary/50"
            aria-label={flip ? "Show the term" : "Show the definition"}
          >
            <span className="block text-sm text-muted-foreground">
              {flip ? "Definition" : "Term"}
            </span>
            <span
              className={
                flip
                  ? "mt-3 block text-lg leading-8"
                  : "mt-4 block font-heading text-3xl font-semibold"
              }
            >
              <Inline text={flip ? card.def : card.term} />
            </span>
            {!flip && (
              <span className="mt-6 block text-sm text-muted-foreground">
                Select to reveal the definition
              </span>
            )}
          </button>
          {flip && (
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="outline" className="h-11" onClick={() => grade(false)}>
                <X className="text-destructive" /> Missed it
              </Button>
              <Button size="lg" className="h-11" onClick={() => grade(true)}>
                <Check /> Got it
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border p-8 text-center">
          <h2 className="text-xl font-semibold">
            {seen ? "Session complete" : "Nothing due right now"}
          </h2>
          <p className="text-muted-foreground">
            {seen
              ? `You reviewed ${seen} card${seen > 1 ? "s" : ""}.`
              : "Every card in this unit is scheduled for later. Come back tomorrow."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSession((n) => n + 1);
              setSeen(0);
            }}
          >
            <RotateCcw /> Check again
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Correct answers move a card up a box and bring it back after 1, 3, 7 and then 21 days.
        Misses send it back to the start.
      </p>
    </div>
  );
}
