import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Focus, ExternalLink, Play } from "lucide-react";
import type { Video } from "@/data/types";
import { VolumeControl } from "@/components/volume-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { setYtVolume } from "@/lib/youtube";
import { actions, useStore } from "@/store/store";
import { cn } from "@/lib/utils";

/**
 * Click-to-load YouTube embed (youtube-nocookie). Nothing is requested from YouTube
 * until the learner presses play, which keeps pages fast and respects privacy.
 * Lesson videos use their own volume setting, separate from the study-tools music.
 * Focus mode widens the player to the available width and the lesson page drops its sidebar and top navigation.
 */
export function YouTubeEmbed({ video, autoplay = false }: { video: Video; autoplay?: boolean }) {
  const [on, setOn] = useState(autoplay);
  const frame = useRef<HTMLIFrameElement>(null);
  const volume = useStore((s) => s.volume.lessons);
  const focus = useStore((s) => s.focusMode);
  const watch = `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ""}`;

  // Apply the saved level whenever it changes while the player is open.
  useEffect(() => {
    if (on) setYtVolume(frame.current, volume);
  }, [on, volume]);

  return (
    <figure
      className={cn(
        "overflow-hidden bg-black",
        // Focus mode: full-bleed. Cancel the page padding and drop the card chrome so it reads as a screen, not a card.
        focus ? "-mx-4 rounded-none border-0 shadow-none lg:-mx-8" : "rounded-xl border shadow-sm",
      )}
    >
      <div className={cn("relative aspect-video w-full", focus && "max-h-[calc(100svh-7rem)]")}>
        {on ? (
          <iframe
            ref={frame}
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${video.start ? `&start=${video.start}` : ""}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setYtVolume(frame.current, volume)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOn(true)}
            className="group absolute inset-0 size-full cursor-pointer"
            aria-label={`Play video: ${video.title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="size-full object-cover opacity-80 transition group-hover:opacity-100"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-110">
                <Play className="ml-1 size-7 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-card px-4 py-2.5 text-sm text-card-foreground">
        <span className="min-w-0">
          <span className="block truncate font-medium">{video.title}</span>
          <span className="text-xs text-muted-foreground">{video.channel}, YouTube</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <VolumeControl
            value={volume}
            onChange={(v) => actions.setVolume("lessons", v)}
            label="Lesson video"
          />
          <Button
            variant={focus ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={focus}
            title={
              focus ? "Leave focus mode (Esc)" : "Focus mode: widen the video and hide navigation"
            }
            onClick={() => actions.setFocusMode(!focus)}
          >
            <Focus /> Focus mode
          </Button>
          <a
            href={watch}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ExternalLink /> Watch on YouTube
          </a>
        </span>
      </figcaption>
    </figure>
  );
}

/** YouTube titles often end with " | course name"; the list shows the part before it. */
const shortTitle = (t: string) => t.split(" | ")[0];

/**
 * A lesson's videos: one player, and when there are several lectures, a single scrollable row under it with
 * Previous and Next. The row stays one card tall however many lectures there are; two or three fit without scrolling.
 * Choosing a lecture starts it straight away, because the learner asked for it.
 */
export function LessonVideos({
  videos,
  listClassName,
}: {
  videos: Video[];
  listClassName?: string;
}) {
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState(false);
  const row = useRef<HTMLOListElement>(null);
  const index = Math.min(active, videos.length - 1);
  const video = videos[index];

  // Keep the current lecture's card in view when it changes (including from Previous and Next).
  useEffect(() => {
    const card = row.current?.children[index] as HTMLElement | undefined;
    if (!card || !row.current) return;
    const r = row.current;
    const left = card.offsetLeft - r.offsetLeft;
    if (left < r.scrollLeft || left + card.offsetWidth > r.scrollLeft + r.clientWidth)
      r.scrollTo({ left: left - 8, behavior: "smooth" });
  }, [index]);

  if (!video) return null;
  const go = (i: number) => {
    setActive(i);
    setChosen(true);
  };

  return (
    <div className="space-y-3">
      <YouTubeEmbed key={video.id} video={video} autoplay={chosen} />
      {videos.length > 1 && (
        <nav aria-label="Lectures in this lesson" className={cn("space-y-2", listClassName)}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Lecture {index + 1} of {videos.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => go(index - 1)}
                aria-label="Previous lecture"
              >
                <ChevronLeft /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index === videos.length - 1}
                onClick={() => go(index + 1)}
                aria-label="Next lecture"
              >
                Next <ChevronRight />
              </Button>
            </div>
          </div>
          <ol ref={row} className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {videos.map((v, i) => {
              const current = i === index;
              return (
                <li key={v.id} className="w-64 shrink-0 snap-start">
                  <button
                    type="button"
                    aria-current={current || undefined}
                    onClick={() => go(i)}
                    className={cn(
                      "group flex h-full w-full items-start gap-3 rounded-lg border p-2 text-left transition-colors",
                      current
                        ? "border-primary/60 bg-primary/5"
                        : "bg-card hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    <span className="relative w-24 shrink-0 overflow-hidden rounded-md bg-black">
                      <img
                        src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className={cn(
                          "aspect-video w-full object-cover transition",
                          current ? "opacity-100" : "opacity-75 group-hover:opacity-100",
                        )}
                      />
                      <span className="absolute top-1 left-1 grid size-5 place-items-center rounded bg-black/70 text-xs font-semibold text-white tabular-nums">
                        {i + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "line-clamp-2 text-sm leading-snug font-medium",
                          current && "text-primary",
                        )}
                      >
                        {shortTitle(v.title)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {current ? "Now showing" : v.channel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}
