import { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { useTheme } from "next-themes";
import { Download } from "lucide-react";
import "@uiw/react-md-editor/markdown-editor.css";
import "katex/dist/katex.min.css";
import type { Course, Lesson } from "@/data/types";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { download } from "@/store/backup";
import { writeNoteFile, useFolder } from "@/store/folder";
import { actions, useStore } from "@/store/store";

/** Markdown notes with Edit and View modes. Supports GitHub-flavoured Markdown and $LaTeX$. */
export default function NotesEditor({ course, lesson }: { course: Course; lesson: Lesson }) {
  const stored = useStore((s) => s.notes[`${course.slug}/${lesson.id}`] ?? "");
  const { resolvedTheme } = useTheme();
  const folder = useFolder();
  const [text, setText] = useState(stored);
  const [mode, setMode] = useState<"edit" | "view">(stored.trim() ? "view" : "edit");
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setText(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.slug, lesson.id]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function change(v: string) {
    setText(v);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      actions.setNote(course.slug, lesson.id, v);
      if (folder.perm === "granted") void writeNoteFile(course.slug, lesson.id, v);
      setSaved(true);
    }, 500);
  }

  return (
    <div className="space-y-3" data-color-mode={resolvedTheme === "dark" ? "dark" : "light"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "view")}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="view">View</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span role="status">
            {saved
              ? folder.perm === "granted"
                ? "Saved, and written to notes.md in your folder"
                : "Saved on this device"
              : "Saving…"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!text.trim()}
            onClick={() =>
              download(
                new Blob([`# ${lesson.title}\n\n${text}\n`], { type: "text/markdown" }),
                `${lesson.id}-notes.md`,
              )
            }
          >
            <Download /> Export .md
          </Button>
        </div>
      </div>
      {mode === "edit" ? (
        <MDEditor
          value={text}
          onChange={(v) => change(v ?? "")}
          preview="edit"
          height={380}
          minHeight={160}
          visibleDragbar={false}
          textareaProps={{ placeholder: "Write your notes in Markdown. Use $x^2$ for maths." }}
        />
      ) : text.trim() ? (
        <Markdown text={text} />
      ) : (
        <p className="text-muted-foreground">No notes yet. Switch to Edit to write some.</p>
      )}
    </div>
  );
}
