import { Suspense, lazy, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, Download, NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { courses, findLesson, getCourse } from "@/data/courses";
import { download } from "@/store/backup";
import { actions, useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import { createSearch } from "@/lib/search";

const NotesEditor = lazy(() => import("@/components/notes-editor"));

interface Entry {
  key: string;
  course: (typeof courses)[number];
  unitId: string;
  unitTitle: string;
  unitIndex: number;
  lessonId: string;
  lessonTitle: string;
}

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** All your notes in one place, grouped by course and unit, one note per lesson. */
export function Notebook() {
  const notes = useStore((s) => s.notes);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(false);
  const selected = params.get("note");

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const course of courses) {
      course.modules.forEach((m, unitIndex) => {
        for (const l of m.lessons) {
          const key = `${course.slug}/${l.id}`;
          if (notes[key]?.trim())
            out.push({
              key,
              course,
              unitId: m.id,
              unitTitle: m.title,
              unitIndex,
              lessonId: l.id,
              lessonTitle: l.title,
            });
        }
      });
    }
    return out;
  }, [notes]);

  const shown = useMemo(() => {
    const found = createSearch(entries, (e) => [
      { text: e.lessonTitle, weight: 6 },
      { text: notes[e.key] ?? "", weight: 3 },
      { text: e.unitTitle, weight: 2 },
      { text: e.course.title, weight: 1 },
    ]).search(q);
    if (found.empty) return entries;
    // Grouping below keeps course order, so only membership matters here.
    const hit = new Set(found.results.map((r) => r.item));
    return entries.filter((e) => hit.has(e));
  }, [entries, q, notes]);

  // Group by course then unit; lessons stay in course order.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: Entry[] }>();
    for (const e of shown) {
      const gk = `${e.course.slug}/${e.unitId}`;
      if (!map.has(gk))
        map.set(gk, { title: `Unit ${e.unitIndex + 1}: ${e.unitTitle}`, items: [] });
      map.get(gk)!.items.push(e);
    }
    return [...map.values()];
  }, [shown]);

  const [slug, lessonId] = selected?.split("/") ?? [];
  const course = getCourse(slug);
  const found = course && findLesson(course, lessonId);
  const select = (key: string | null) => {
    const next = new URLSearchParams(params);
    if (key) next.set("note", key);
    else next.delete("note");
    setParams(next, { replace: true });
  };

  // Every lesson, for starting a note on a lesson that has none yet.
  const lessonOptions = courses.flatMap((c) =>
    c.modules.map((m, i) => ({
      label: `Unit ${i + 1}: ${m.title}`,
      items: m.lessons.map((l) => ({ value: `${c.slug}/${l.id}`, label: l.title })),
    })),
  );

  function exportAll() {
    const lines = ["# My notebook", ""];
    let last = "";
    for (const e of entries) {
      const heading = `## ${e.course.title}: Unit ${e.unitIndex + 1}, ${e.unitTitle}`;
      if (heading !== last) {
        lines.push(heading, "");
        last = heading;
      }
      lines.push(`### ${e.lessonTitle}`, "", notes[e.key].trim(), "");
    }
    download(new Blob([lines.join("\n")], { type: "text/markdown" }), "my-notebook.md");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Notebook</h1>
          <p className="text-muted-foreground">
            {entries.length === 0
              ? "Your notes will be grouped by lesson here."
              : `${entries.length} ${entries.length === 1 ? "note" : "notes"}, grouped by lesson.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value=""
            onValueChange={(v) => v && select(v as string)}
            items={lessonOptions.flatMap((g) => g.items)}
          >
            <SelectTrigger className="h-9 w-52" aria-label="New note for a lesson">
              <Plus className="size-4" />
              <SelectValue placeholder="New note for a lesson" />
            </SelectTrigger>
            <SelectContent>
              {lessonOptions.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportAll} disabled={entries.length === 0}>
            <Download /> Export all
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
        <aside className="space-y-4" aria-label="Notes">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Search notes"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search notes"
            />
          </div>
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-muted-foreground">
              No notes yet. Open a lesson and use its Notes tab, or start one here with "New note
              for a lesson".
            </p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground">No notes match.</p>
          ) : (
            groups.map((g) => (
              <section key={g.title} className="space-y-1">
                <h2 className="px-2 text-sm font-semibold text-muted-foreground">{g.title}</h2>
                <ul className="space-y-0.5">
                  {g.items.map((e) => (
                    <li key={e.key}>
                      <button
                        type="button"
                        onClick={() => select(e.key)}
                        aria-current={selected === e.key ? "true" : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted",
                          selected === e.key && "bg-accent font-medium ring-1 ring-primary/30",
                        )}
                      >
                        <span className="min-w-0 truncate">{e.lessonTitle}</span>
                        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                          {words(notes[e.key])} w
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </aside>

        <section className="min-w-0" aria-label="Selected note">
          {!found || !course ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <NotebookPen className="size-7" />
              <p>
                {entries.length
                  ? "Select a note to read or edit it."
                  : "Choose a lesson to start your first note."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{found.module.title}</div>
                  <h2 className="text-2xl font-semibold">{found.lesson.title}</h2>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/learn/${course.slug}/${found.lesson.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <BookOpen className="size-4" /> Open lesson
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!notes[selected!]?.trim()}
                    onClick={() => setConfirm(true)}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
              <Suspense fallback={<p className="text-muted-foreground">Loading editor…</p>}>
                <NotesEditor key={selected} course={course} lesson={found.lesson} />
              </Suspense>
            </div>
          )}
        </section>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>
              The note for "{found?.lesson.title}" will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (course && found) actions.setNote(course.slug, found.lesson.id, "");
                setConfirm(false);
                select(null);
                toast.success("Note deleted");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
