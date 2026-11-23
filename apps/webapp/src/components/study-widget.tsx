import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AudioLines,
  ChevronDown,
  Headphones,
  Radio,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CYCLE, MODE_LABEL, chime, remaining, timer, useTimer, type Mode } from "@/store/timer";
import { actions, useStore } from "@/store/store";
import { dayKey } from "@/lib/format";
import { VolumeInline } from "@/components/volume-control";
import { embedUrl, fetchTitle, parseSource, setYtVolume } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Floating study tools: Pomodoro timer and your own music list. Mounted once in the layout so both keep running
 * while you move around. Durations, alerts and the music list are managed in Settings.
 */
export function StudyWidget() {
  const t = useTimer();
  const focusToday = useStore((s) => s.focus[dayKey()] ?? 0);
  const streams = useStore((s) => s.streams);
  const musicVolume = useStore((s) => s.volume.music);
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"timer" | "music">("timer");
  const [now, setNow] = useState(Date.now());
  const [playing, setPlaying] = useState<string | null>(null); // stream id
  const [link, setLink] = useState("");
  // The mini player is independent of the panel: it stays up across tabs and when the panel is closed until you hide it.
  const [showPlayer, setShowPlayer] = useState(true);
  const title = useRef(document.title);
  const current = streams.find((s) => s.id === playing);

  // One ticking clock while the timer runs.
  useEffect(() => {
    if (!t.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [t.running]);

  // Finish a period when it reaches zero (also catches a timer that ended while the tab was closed).
  useEffect(() => {
    if (!t.running || !t.endAt || now < t.endAt) return;
    const was = t.mode;
    const next = timer.complete();
    chime();
    const msg =
      was === "focus"
        ? `Focus session done. Time for a ${MODE_LABEL[next].toLowerCase()}.`
        : "Break over. Ready to focus?";
    toast.success(msg);
    if (t.alerts && typeof Notification !== "undefined" && Notification.permission === "granted")
      new Notification("Launchpad", { body: msg });
  }, [t.running, t.endAt, t.mode, t.alerts, now]);

  // Show the countdown in the tab title so you can watch it from another tab.
  const left = remaining(t, now);
  useEffect(() => {
    if (t.running) document.title = `${fmtClock(left)} ${MODE_LABEL[t.mode]} · Launchpad`;
    else document.title = title.current;
    return () => {
      document.title = title.current;
    };
  }, [t.running, t.mode, left]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Study music has its own volume, separate from lesson videos.
  useEffect(() => {
    if (playing) setYtVolume(frame.current, musicVolume);
  }, [playing, musicVolume]);

  // If the playing stream is removed in Settings, stop the player.
  useEffect(() => {
    if (playing && !streams.some((s) => s.id === playing)) setPlaying(null);
  }, [streams, playing]);

  const total = t.cfg[t.mode] * 60_000;
  const pct = total ? ((total - left) / total) * 100 : 0;
  const started = t.running || left < total;

  const addAndPlay = async () => {
    const src = parseSource(link);
    if (!src) return toast.error("That does not look like a YouTube link or video ID.");
    const label =
      (await fetchTitle(src)) ?? (src.kind === "playlist" ? "YouTube playlist" : "YouTube stream");
    setPlaying(actions.addStream({ ...src, label }));
    setShowPlayer(true);
    setLink("");
  };

  return (
    <div className="no-print fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {/* The iframe stays mounted even when hidden, so music never stops until you stop it. */}
      {current && (
        <div
          className={cn(
            "w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card shadow-lg",
            !showPlayer && "pointer-events-none fixed -left-[200vw]",
          )}
        >
          <div className="flex items-center gap-1 border-b px-3 py-1.5">
            <AudioLines className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={current.label}>
              {current.label}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Hide player (music keeps playing)"
              title="Hide player"
              onClick={() => setShowPlayer(false)}
            >
              <ChevronDown />
            </Button>
          </div>
          <div className="flex items-center gap-1 border-b px-2 py-1">
            <VolumeInline
              value={musicVolume}
              onChange={(v) => actions.setVolume("music", v)}
              label="Study music"
              className="flex-1 justify-between"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Stop music"
              title="Stop music"
              onClick={() => setPlaying(null)}
            >
              <Square />
            </Button>
          </div>
          <div className="aspect-video bg-black">
            <iframe
              ref={frame}
              onLoad={() => setYtVolume(frame.current, musicVolume)}
              className="size-full"
              src={embedUrl(current)}
              title={`Playing: ${current.label}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Study tools"
          className="max-h-[70svh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Study tools</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close study tools"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </header>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "timer" | "music")}>
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="timer">
                <Timer className="size-4" /> Timer
              </TabsTrigger>
              <TabsTrigger value="music">
                <Headphones className="size-4" /> Music
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "timer" ? (
            <div className="space-y-4">
              <div
                className="flex gap-1 rounded-lg bg-muted p-1"
                role="group"
                aria-label="Timer mode"
              >
                {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={t.mode === m}
                    onClick={() => timer.setMode(m)}
                    className={cn(
                      "flex-1 cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                      t.mode === m
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <div
                  className="font-heading text-6xl font-semibold tabular-nums"
                  role="timer"
                  aria-live="off"
                >
                  {fmtClock(left)}
                </div>
                <div
                  className="mx-auto mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div
                    className="h-full bg-primary transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className="mt-3 flex items-center justify-center gap-1.5"
                  aria-label={`${t.round} of ${CYCLE} focus sessions done in this set`}
                >
                  {Array.from({ length: CYCLE }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-2.5 rounded-full",
                        i < t.round ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                {t.running ? (
                  <Button size="lg" className="h-11 px-6" onClick={() => timer.pause()}>
                    <Pause /> Pause
                  </Button>
                ) : (
                  <Button size="lg" className="h-11 px-6" onClick={() => timer.start()}>
                    <Play /> {started ? "Resume" : "Start"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Reset"
                  title="Reset"
                  onClick={() => timer.reset()}
                  disabled={!started}
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Skip to next"
                  title="Skip to next"
                  onClick={() => timer.complete(false)}
                >
                  <SkipForward />
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {focusToday} min focused today.{" "}
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="font-medium text-foreground hover:text-primary"
                >
                  Timer settings
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {streams.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Your music list is empty. Paste a YouTube link below to play it and add it to your
                  list.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                  {streams.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(s.id);
                          setShowPlayer(true);
                        }}
                        aria-pressed={playing === s.id}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted",
                          playing === s.id && "border-primary bg-accent",
                        )}
                      >
                        <Radio className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{s.label}</span>
                          <span className="block text-sm text-muted-foreground">
                            {s.kind === "playlist" ? "Playlist" : "Video or live stream"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addAndPlay();
                }}
              >
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Paste a YouTube link"
                  aria-label="YouTube link to add"
                />
                <Button type="submit" variant="outline" disabled={!link.trim()}>
                  Add
                </Button>
              </form>
              {current && (
                <Button variant="outline" className="w-full" onClick={() => setPlaying(null)}>
                  <Square /> Stop music
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Rename or remove items in{" "}
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="font-medium text-foreground hover:text-primary"
                >
                  Settings
                </Link>
                . Music keeps playing when you close this panel.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="flex items-center gap-2">
        {current && (
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={showPlayer ? "Hide player" : "Show player"}
            aria-pressed={showPlayer}
            title={showPlayer ? "Hide player" : "Show player"}
            onClick={() => setShowPlayer((v) => !v)}
            className="size-12 rounded-full bg-card shadow-lg"
          >
            <Headphones className={cn(!showPlayer && "animate-pulse")} />
          </Button>
        )}
        <Button
          size="lg"
          aria-expanded={open}
          aria-label={open ? "Close study tools" : "Open study tools"}
          onClick={() => setOpen((o) => !o)}
          className="h-12 rounded-full px-4 shadow-lg"
        >
          {current ? <AudioLines className="animate-pulse" /> : <Timer />}
          <span className="tabular-nums">{started ? fmtClock(left) : "Study tools"}</span>
        </Button>
      </div>
    </div>
  );
}
