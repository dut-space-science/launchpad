import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Download, FolderOpen, Monitor, Moon, Sun, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
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

export function SettingsPage() {
  const name = useStore((s) => s.profile.name);
  const { theme, setTheme } = useTheme();
  const folder = useFolder();
  const [resetOpen, setResetOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [wiping, setWiping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            key={name}
            defaultValue={name}
            onBlur={(e) => actions.setName(e.target.value.trim())}
            placeholder="Full name"
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(
            [
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
              ["system", Monitor, "System"],
            ] as const
          ).map(([v, Icon, l]) => (
            <Button
              key={v}
              variant={theme === v ? "default" : "outline"}
              onClick={() => setTheme(v)}
            >
              <Icon /> {l}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VolumeRow label="Lesson videos" kind="lessons" />
          <VolumeRow label="Study music" kind="music" />
        </CardContent>
      </Card>

      <StudySettings />

      <Card>
        <CardHeader>
          <CardTitle>Learning folder</CardTitle>
          <CardDescription>
            Save lesson files and notes to a folder on your computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!folder.supported ? (
            <p className="text-muted-foreground">Needs Chrome or Edge.</p>
          ) : folder.connected ? (
            <>
              <p>
                Folder: <span className="font-semibold">{folder.name}</span>
                {folder.perm !== "granted" && (
                  <span className="text-muted-foreground">
                    {" "}
                    (access needs approval this session)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {folder.perm !== "granted" && (
                  <Button onClick={() => void allowFolder()}>
                    <FolderOpen /> Allow access
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    connectFolder().catch(
                      (e: Error) => e.name !== "AbortError" && toast.error(e.message),
                    )
                  }
                >
                  Change folder
                </Button>
                <Button variant="outline" onClick={() => void disconnectFolder()}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <Button
              onClick={() =>
                connectFolder().catch(
                  (e: Error) => e.name !== "AbortError" && toast.error(e.message),
                )
              }
            >
              <FolderOpen /> Choose folder
            </Button>
          )}
        </CardContent>
      </Card>

      <StorageCard />

      <Card>
        <CardHeader>
          <CardTitle>Backup and restore</CardTitle>
          <CardDescription>
            Save your progress to a file, or restore it. Restoring replaces what you have now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const r = await saveBackup();
                if (r !== "cancelled") toast.success("Backup saved");
              }}
            >
              <Download /> Save backup
            </Button>
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
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Reset</CardTitle>
          <CardDescription>
            Clear your progress, notes, scores, flashcards and name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger render={<Button variant="destructive" />}>
              <Trash2 /> Reset everything
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Erase all learning data?</DialogTitle>
                <DialogDescription>This cannot be undone.</DialogDescription>
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
                    toast.success("All data erased");
                  }}
                >
                  Erase
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Wipe all data</CardTitle>
          <CardDescription>
            Delete everything on this device, including courses and saved settings, and start over.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={confirm} onOpenChange={setConfirm}>
            <DialogTrigger render={<Button variant="destructive" />}>
              <Trash2 /> Wipe all data
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Wipe everything?</DialogTitle>
                <DialogDescription>
                  Everything saved on this device will be deleted. This cannot be undone. Files in
                  your learning folder are not touched.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={wiping}
                  onClick={async () => {
                    setWiping(true);
                    try {
                      await wipeEverything();
                      setConfirm(false);
                      toast.success("Database wiped");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not wipe the database");
                    } finally {
                      setWiping(false);
                    }
                  }}
                >
                  {wiping ? "Wiping…" : "Wipe everything"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

/** Pomodoro lengths, alerts and the learner's own study-music list. The floating widget only uses these. */
function StudySettings() {
  const t = useTimer();
  const streams = useStore((s) => s.streams);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");

  async function add() {
    const src = parseSource(link);
    if (!src) return toast.error("That does not look like a YouTube link or video ID.");
    const label =
      name.trim() ||
      (await fetchTitle(src)) ||
      (src.kind === "playlist" ? "YouTube playlist" : "YouTube stream");
    actions.addStream({ ...src, label });
    setLink("");
    setName("");
    toast.success("Added to your music list");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Study tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="timer-settings">
          <h3 id="timer-settings" className="font-semibold">
            Timer
          </h3>
          <div className="grid max-w-md grid-cols-3 gap-3">
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
              <div key={m} className="space-y-1.5">
                <Label htmlFor={`min-${m}`}>{MODE_LABEL[m]} (min)</Label>
                <Input
                  id={`min-${m}`}
                  type="number"
                  min={1}
                  max={180}
                  value={t.cfg[m]}
                  onChange={(e) => timer.setMinutes(m, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="alerts"
              checked={t.alerts}
              onCheckedChange={async (on) => {
                const ok = await timer.setAlerts(on);
                if (on && !ok)
                  toast.error(
                    "Notifications are blocked. Allow them in your browser's site settings.",
                  );
              }}
            />
            <Label htmlFor="alerts">Show a notification when a session ends</Label>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="music-settings">
          <h3 id="music-settings" className="font-semibold">
            Music
          </h3>
          {streams.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No music yet.
            </p>
          ) : (
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
                    className="shrink-0 text-sm text-primary"
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              aria-label="Name"
            />
            <Button type="submit" disabled={!link.trim()}>
              Add
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}

function VolumeRow({ label, kind }: { label: string; kind: "lessons" | "music" }) {
  const value = useStore((s) => s.volume[kind]);
  return (
    <div className="space-y-2">
      <div className="font-medium">{label}</div>
      <VolumeSlider value={value} onChange={(v) => actions.setVolume(kind, v)} label={label} />
    </div>
  );
}

/** Which engine holds your data, with a download of the real SQLite file and a request for persistent storage. */
function StorageCard() {
  const info = useStorageInfo();
  const [size, setSize] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((e) => setSize({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground">Engine</dt>
          <dd className="font-medium">
            {info.engine === "sqlite"
              ? `SQLite ${info.sqlite ?? ""} (WebAssembly)`
              : "localStorage (fallback)"}
          </dd>
          {info.engine === "sqlite" && (
            <>
              <dt className="text-muted-foreground">Location</dt>
              <dd>Browser private file system (OPFS)</dd>
            </>
          )}
          <dt className="text-muted-foreground">Course content</dt>
          <dd className="font-medium">
            {courses.length > 0
              ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} installed`
              : "None"}
          </dd>
          {size && (
            <>
              <dt className="text-muted-foreground">Browser storage</dt>
              <dd>
                {bytes(size.usage)} used of about {bytes(size.quota)}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Protected</dt>
          <dd>{persisted ? "Yes" : "No"}</dd>
        </dl>
        {info.fallbackReason && (
          <p className="text-sm text-destructive">SQLite unavailable: {info.fallbackReason}</p>
        )}
        {info.writeError && (
          <p className="text-sm text-destructive">The last save failed: {info.writeError}</p>
        )}
        {contentStatus.error && (
          <p className="text-sm text-destructive">
            The latest courses could not be installed: {contentStatus.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {(contentStatus.source === "default" || info.engine !== "sqlite") && (
            <Button
              variant="outline"
              onClick={() =>
                void useLaunchpadCourses().catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : "Could not reinstall the courses"),
                )
              }
            >
              Reinstall Launchpad courses
            </Button>
          )}
          <Button
            variant="outline"
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
            <Download /> Download database (.sqlite)
          </Button>
          <Button
            variant="outline"
            disabled={persisted === true}
            onClick={async () => {
              const ok = (await navigator.storage?.persist?.()) ?? false;
              setPersisted(ok);
              toast[ok ? "success" : "info"](
                ok
                  ? "Your data is now protected from automatic clean-up"
                  : "The browser declined. Keep a backup file as well.",
              );
            }}
          >
            {persisted ? "Protected from clean-up" : "Protect my data from clean-up"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
