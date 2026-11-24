import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  Download,
  FolderOpen,
  Monitor,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { VolumeSlider } from "@/components/volume-control";
import { MODE_LABEL, timer, useTimer, type Mode } from "@/store/timer";
import { embedUrl, fetchTitle, parseSource } from "@/lib/youtube";
import { download, restoreBackup, saveBackup } from "@/store/backup";
import { exportDatabase, useStorageInfo, wipeEverything } from "@/store/persistence";
import { bytes } from "@/lib/format";
import { allowFolder, connectFolder, disconnectFolder, useFolder } from "@/store/folder";
import { actions, useStore } from "@/store/store";
import { courses } from "@/data/courses";
import { contentStatus, useLaunchpadCourses } from "@/content/load";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "you", title: "You" },
  { id: "study", title: "Study" },
  { id: "storage", title: "Files and storage" },
  { id: "data", title: "Your data" },
] as const;

/** When the last backup file was saved from this browser. Wipe all data clears it with the other launchpad keys. */
const BACKUP_KEY = "launchpad:last-backup";

function ago(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** One setting: what it is on the left, the control on the right; stacked on narrow screens. */
function Row({
  label,
  hint,
  htmlFor,
  children,
  danger = false,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className={cn("font-medium", danger && "text-destructive")}>
          {label}
        </label>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-1 divide-y border-t">{children}</div>
    </section>
  );
}

/** The opening line: where progress lives, and whether it is backed up. */
function SafetyLine({ lastBackup, onBackup }: { lastBackup: number | null; onBackup: () => void }) {
  const info = useStorageInfo();
  const problem = info.writeError ?? (info.engine !== "sqlite" ? info.fallbackReason : undefined);
  const safe = lastBackup !== null && !problem;
  const Icon = safe ? ShieldCheck : ShieldAlert;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3",
        info.writeError ? "border-destructive/50 bg-destructive/5" : "bg-muted/40",
      )}
      role="status"
    >
      <Icon
        className={cn("size-5 shrink-0", safe ? "text-primary" : "text-muted-foreground")}
        aria-hidden
      />
      <p className="min-w-0 flex-1">
        {info.writeError ? (
          <>The last save failed: {info.writeError}. Save a backup now.</>
        ) : lastBackup === null ? (
          <>
            Your progress is saved only in this browser. <strong>No backup yet.</strong>
          </>
        ) : (
          <>Your progress is saved in this browser. Last backup {ago(lastBackup)}.</>
        )}
      </p>
      <Button variant={safe ? "outline" : "default"} onClick={onBackup}>
        <Download /> Save backup
      </Button>
    </div>
  );
}

export function SettingsPage() {
  const name = useStore((s) => s.profile.name);
  const { theme, setTheme } = useTheme();
  const [lastBackup, setLastBackup] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(BACKUP_KEY));
    return v > 0 ? v : null;
  });
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  async function backup() {
    const r = await saveBackup();
    if (r === "cancelled") return;
    const now = Date.now();
    localStorage.setItem(BACKUP_KEY, String(now));
    setLastBackup(now);
    toast.success("Backup saved");
  }

  // Highlight the section being read in the index.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => !!e,
    );
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <div className="mt-6">
        <SafetyLine lastBackup={lastBackup} onBackup={() => void backup()} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={active === s.id || undefined}
                  onClick={() =>
                    document.getElementById(s.id)?.scrollIntoView({
                      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                    })
                  }
                  className={cn(
                    "w-full border-l-2 py-1.5 pl-3 text-left transition-colors",
                    active === s.id
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-12">
          <Section id="you" title="You">
            <Row label="Name" hint="Shown on your dashboard and certificates." htmlFor="name">
              <Input
                id="name"
                key={name}
                defaultValue={name}
                onBlur={(e) => actions.setName(e.target.value.trim())}
                placeholder="Full name"
                className="w-full sm:w-72"
              />
            </Row>
            <Row label="Theme">
              <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Theme">
                {(
                  [
                    ["light", Sun, "Light"],
                    ["dark", Moon, "Dark"],
                    ["system", Monitor, "System"],
                  ] as const
                ).map(([v, Icon, l]) => (
                  <Button
                    key={v}
                    variant={theme === v ? "secondary" : "ghost"}
                    aria-pressed={theme === v}
                    onClick={() => setTheme(v)}
                  >
                    <Icon /> {l}
                  </Button>
                ))}
              </div>
            </Row>
          </Section>

          <StudySection />
          <StorageSection />
          <DataSection onBackup={() => void backup()} />
        </div>
      </div>
    </div>
  );
}

/** Timer lengths, alerts, playback volume and the learner's study-music list. */
function StudySection() {
  const t = useTimer();
  const streams = useStore((s) => s.streams);
  const lessons = useStore((s) => s.volume.lessons);
  const music = useStore((s) => s.volume.music);
  const [link, setLink] = useState("");
  const [label, setLabel] = useState("");

  async function add() {
    const src = parseSource(link);
    if (!src) return toast.error("That is not a YouTube link or video ID.");
    const name =
      label.trim() ||
      (await fetchTitle(src)) ||
      (src.kind === "playlist" ? "YouTube playlist" : "YouTube stream");
    actions.addStream({ ...src, label: name });
    setLink("");
    setLabel("");
    toast.success("Added to your music list");
  }

  return (
    <Section id="study" title="Study">
      <Row label="Timer" hint="Session lengths in minutes.">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <label key={m} className="grid gap-1 text-center text-xs text-muted-foreground">
            {MODE_LABEL[m]}
            <Input
              type="number"
              min={1}
              max={180}
              value={t.cfg[m]}
              onChange={(e) => timer.setMinutes(m, Number(e.target.value))}
              className="w-24 text-center text-base text-foreground tabular-nums"
            />
          </label>
        ))}
      </Row>
      <Row label="Session alerts" hint="Show a notification when a session ends." htmlFor="alerts">
        <Switch
          id="alerts"
          checked={t.alerts}
          onCheckedChange={async (on) => {
            const ok = await timer.setAlerts(on);
            if (on && !ok)
              toast.error("Notifications are blocked. Allow them in your browser's site settings.");
          }}
        />
      </Row>
      <Row label="Lesson video volume">
        <div className="w-full sm:w-80">
          <VolumeSlider
            value={lessons}
            onChange={(v) => actions.setVolume("lessons", v)}
            label="Lesson videos"
          />
        </div>
      </Row>
      <Row label="Study music volume">
        <div className="w-full sm:w-80">
          <VolumeSlider
            value={music}
            onChange={(v) => actions.setVolume("music", v)}
            label="Study music"
          />
        </div>
      </Row>
      <div className="space-y-3 py-5">
        <div>
          <div className="font-medium">Study music</div>
          <p className="text-sm text-muted-foreground">
            YouTube videos, live streams or playlists for the study tools player.
          </p>
        </div>
        {streams.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {streams.map((s) => (
              <li key={s.id} className="flex items-center gap-2 p-2">
                <Input
                  defaultValue={s.label}
                  aria-label={`Name for ${s.label}`}
                  onBlur={(e) =>
                    e.target.value.trim() && actions.renameStream(s.id, e.target.value.trim())
                  }
                />
                <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
                  {s.kind === "playlist" ? "Playlist" : "Video or live"}
                </span>
                <a
                  href={embedUrl(s)
                    .replace("/embed/", "/watch?v=")
                    .split("?autoplay")[0]
                    .replace("youtube-nocookie.com", "youtube.com")}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 px-2 text-sm font-medium text-primary"
                >
                  Open
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${s.label}`}
                  onClick={() => actions.removeStream(s.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="YouTube link"
            aria-label="YouTube link"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name (optional)"
            aria-label="Name"
          />
          <Button type="submit" variant="outline" disabled={!link.trim()}>
            Add music
          </Button>
        </form>
      </div>
    </Section>
  );
}

/** The learning folder, installed courses, space used, protection from clean-up and the raw database file. */
function StorageSection() {
  const folder = useFolder();
  const info = useStorageInfo();
  const [size, setSize] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((e) => setSize({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const pick = () =>
    connectFolder().catch((e: Error) => e.name !== "AbortError" && toast.error(e.message));

  return (
    <Section id="storage" title="Files and storage">
      <Row
        label="Learning folder"
        hint={
          !folder.supported
            ? "Needs Chrome or Edge."
            : folder.connected
              ? `Saving lesson files and notes to “${folder.name}”${folder.perm !== "granted" ? ". Access needs approval this session." : "."}`
              : "Save lesson files and notes to a folder on your computer."
        }
      >
        {folder.supported &&
          (folder.connected ? (
            <>
              {folder.perm !== "granted" && (
                <Button onClick={() => void allowFolder()}>
                  <FolderOpen /> Allow access
                </Button>
              )}
              <Button variant="outline" onClick={() => void pick()}>
                Change
              </Button>
              <Button variant="ghost" onClick={() => void disconnectFolder()}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => void pick()}>
              <FolderOpen /> Choose folder
            </Button>
          ))}
      </Row>

      <Row
        label="Courses"
        hint={
          contentStatus.error ? (
            <span className="text-destructive">
              The latest courses could not be installed: {contentStatus.error}
            </span>
          ) : courses.length > 0 ? (
            `${courses.length} ${courses.length === 1 ? "course" : "courses"} installed.`
          ) : (
            "No courses installed."
          )
        }
      >
        {(contentStatus.source === "default" || info.engine !== "sqlite") && (
          <Button
            variant="outline"
            onClick={() =>
              void useLaunchpadCourses().catch((e: unknown) =>
                toast.error(e instanceof Error ? e.message : "Could not reinstall the courses"),
              )
            }
          >
            Reinstall courses
          </Button>
        )}
      </Row>

      <Row
        label="Protect from clean-up"
        hint={
          persisted
            ? "The browser will not delete your data to free space."
            : "Ask the browser not to delete your data when space runs low."
        }
      >
        {persisted ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" /> Protected
          </span>
        ) : (
          <Button
            variant="outline"
            onClick={async () => {
              const ok = (await navigator.storage?.persist?.()) ?? false;
              setPersisted(ok);
              toast[ok ? "success" : "info"](
                ok
                  ? "Your data is protected from clean-up"
                  : "The browser declined. Keep a backup file as well.",
              );
            }}
          >
            Protect my data
          </Button>
        )}
      </Row>

      <Row
        label="Database file"
        hint={
          <>
            {size && `${bytes(size.usage)} used of about ${bytes(size.quota)}. `}
            {info.engine === "sqlite"
              ? `SQLite ${info.sqlite ?? ""} in the browser's private file system.`
              : `Using browser storage instead of SQLite${info.fallbackReason ? `: ${info.fallbackReason}` : "."}`}
          </>
        }
      >
        <Button
          variant="ghost"
          disabled={info.engine !== "sqlite"}
          onClick={async () => {
            const data = await exportDatabase();
            if (!data) return toast.error("There is no SQLite database to download.");
            download(
              new Blob([data], { type: "application/vnd.sqlite3" }),
              `launchpad-${new Date().toISOString().slice(0, 10)}.sqlite`,
            );
          }}
        >
          <Download /> Download .sqlite
        </Button>
      </Row>
    </Section>
  );
}

/** Backup, restore, and the two destructive actions, set apart at the end. */
function DataSection({ onBackup }: { onBackup: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wiping, setWiping] = useState(false);

  return (
    <Section id="data" title="Your data">
      <Row label="Backup" hint="Save your progress, notes and settings to a file.">
        <Button variant="outline" onClick={onBackup}>
          <Download /> Save backup
        </Button>
      </Row>
      <Row label="Restore" hint="Load a backup file. It replaces what is in this browser now.">
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload /> Restore from file
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              await restoreBackup(f);
              toast.success("Progress restored");
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
      </Row>

      <div className="border-t-2 border-destructive/40">
        <Row
          danger
          label="Reset progress"
          hint="Clears your progress, notes, scores, flashcards, music list and name. Courses stay installed."
        >
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              Reset progress
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset your progress?</DialogTitle>
                <DialogDescription>
                  Progress, notes, scores, flashcards, your music list and your name are cleared.
                  This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    actions.reset();
                    setResetOpen(false);
                    toast.success("Progress reset");
                  }}
                >
                  Reset progress
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Row>
      </div>
      <Row
        danger
        label="Wipe this browser"
        hint="Deletes everything Launchpad saved here, courses included, and starts setup again."
      >
        <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>
            <Trash2 /> Wipe all data
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wipe all data?</DialogTitle>
              <DialogDescription>
                Everything Launchpad saved in this browser is deleted. This cannot be undone. Files
                in your learning folder are not touched.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWipeOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={wiping}
                onClick={async () => {
                  setWiping(true);
                  try {
                    await wipeEverything();
                    setWipeOpen(false);
                    toast.success("All data wiped");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not wipe the data");
                  } finally {
                    setWiping(false);
                  }
                }}
              >
                {wiping ? "Wiping…" : "Wipe all data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>
    </Section>
  );
}
