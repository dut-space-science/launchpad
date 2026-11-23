import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FolderOpen, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bytes } from "@/lib/format";
import {
  allowFolder,
  connectFolder,
  folderSupported,
  removeAttachment,
  saveAttachments,
  useAttachments,
  useFolder,
} from "@/store/folder";
import { download } from "@/store/backup";
import { cn } from "@/lib/utils";

/** Lesson attachments live as real files in the learner's chosen folder. */
export function LessonFiles({ course, lesson }: { course: string; lesson: string }) {
  const folder = useFolder();
  const items = useAttachments(course, lesson);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    try {
      await saveAttachments(course, lesson, list);
      toast.success(`Saved ${list.length} file${list.length > 1 ? "s" : ""} to your folder`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!folderSupported) {
    return (
      <p className="rounded-xl border p-5 text-muted-foreground">
        Saving files to a folder needs a Chromium browser such as Chrome or Edge. Your notes still
        work in any browser.
      </p>
    );
  }
  if (!folder.connected) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <h3 className="text-lg font-semibold">Choose a learning folder</h3>
        <p className="max-w-xl text-muted-foreground">
          Attachments and notes are saved as ordinary files in a folder on your computer, organised
          by course and lesson. Nothing is stored inside the browser.
        </p>
        <Button
          onClick={() =>
            connectFolder().catch((e: Error) => e.name !== "AbortError" && toast.error(e.message))
          }
        >
          <FolderOpen /> Choose folder
        </Button>
      </div>
    );
  }
  if (folder.perm !== "granted") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <h3 className="text-lg font-semibold">Allow access to “{folder.name}”</h3>
        <p className="max-w-xl text-muted-foreground">
          Browsers ask again each session before a site can read or write your folder.
        </p>
        <Button onClick={() => void allowFolder()}>
          <FolderOpen /> Allow access
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center",
          drag && "border-primary bg-accent",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p>Drop datasheets, test data, photos or sketches here</p>
        <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-muted-foreground">
          Saved in{" "}
          <span className="font-medium text-foreground">
            {folder.name}/{course}/{lesson}
          </span>
        </p>
      </div>
      {items.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {items.map((f) => (
            <li key={f.name} className="flex items-center gap-3 p-3">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="text-sm text-muted-foreground">
                  {bytes(f.size)}, {new Date(f.modified).toLocaleDateString()}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Download ${f.name}`}
                onClick={async () => download(await f.file(), f.name)}
              >
                <Download />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${f.name}`}
                onClick={() => void removeAttachment(course, lesson, f.name)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
