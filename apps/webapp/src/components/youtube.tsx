import { useEffect, useRef, useState } from "react";
import { Focus, ExternalLink, Play } from "lucide-react";
import type { Video } from "@/data/types";
import { VolumeControl } from "@/components/volume-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { setYtVolume } from "@/lib/youtube";
import { actions, useStore } from "@/store/store";
import { cn } from "@/lib/utils";

/** YouTube titles often end with " | course name"; the register shows the part before it. */
const shortTitle = (t: string) => t.split(" | ")[0];
/** The course part of such a title, when there is one. */
const courseOf = (t: string) => t.split(" | ").slice(1).join(" | ") || undefined;

/**
 * Click-to-load YouTube player (youtube-nocookie). Nothing is requested from YouTube until the learner presses play,
 * which keeps pages fast and respects privacy. `autoplay` starts it at once, for when the learner picked this lecture.
 */
function Player({ video, autoplay }: { video: Video; autoplay: boolean }) {
  const [on, setOn] = useState(autoplay);
  const frame = useRef<HTMLIFrameElement>(null);
  const volume = useStore((s) => s.volume.lessons);
  const focus = useStore((s) => s.focusMode);

  // Apply the saved level whenever it changes while the player is open.
  useEffect(() => {
    if (on) setYtVolume(frame.current, volume);
  }, [on, volume]);

  return (
    <div
      className={cn("relative aspect-video w-full bg-black", focus && "max-h-[calc(100svh-7rem)]")}
    >
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
  );
}

/** Title and source of the lecture on screen, with volume, focus mode and a link out. */
function Caption({ video }: { video: Video }) {
  const volume = useStore((s) => s.volume.lessons);
  const focus = useStore((s) => s.focusMode);
  const watch = `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ""}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <div className="font-heading leading-snug font-medium text-balance">
          {shortTitle(video.title)}
        </div>
        <div className="text-sm text-muted-foreground">
          {courseOf(video.title) ?? video.channel}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <VolumeControl
          value={volume}
          onChange={(v) => actions.setVolume("lessons", v)}
          label="Lesson video"
        />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={focus}
          title={
            focus ? "Leave focus mode (Esc)" : "Focus mode: widen the video and hide navigation"
          }
          className={cn(focus && "bg-muted")}
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
      </div>
    </div>
  );
}

/**
 * A lesson's lectures as one panel on the card surface. The player and its caption sit on the
 * left; when there are several lectures, a numbered register runs down the right on wide screens (exactly as tall as
 * the player, scrolling inside itself) or sits under the player on narrow ones. Ten lectures take no more page height
 * than two. Choosing a lecture starts it at once, because the learner asked for it.
 */
export function LessonVideos({ videos }: { videos: Video[] }) {
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState(false);
  const focus = useStore((s) => s.focusMode);
  const scroller = useRef<HTMLDivElement>(null);
  const index = Math.min(active, videos.length - 1);
  const video = videos[index];
  const many = videos.length > 1;

  // Keep the current lecture in view inside the register when it changes.
  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>("[aria-current]");
    if (!box || !row) return;
    const top = row.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTo({
        top: top - 8,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [index]);

  if (!video) return null;

  return (
    // The register moves beside the player when the panel itself is wide enough (a container query), not the screen:
    // on desktop the lesson page also shows the curriculum sidebar.
    <div className={cn("@container", focus && "-mx-4 lg:-mx-8")}>
      <section
        aria-label={many ? `${videos.length} lectures for this lesson` : "Lecture for this lesson"}
        className={cn(
          "overflow-hidden border bg-card text-card-foreground",
          !focus && "rounded-xl",
          many && "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_18rem]",
        )}
      >
        <div className="min-w-0">
          <Player key={video.id} video={video} autoplay={chosen} />
          <Caption video={video} />
        </div>

        {many && (
          <nav
            aria-label="Lectures in this lesson"
            className="relative border-t @3xl:border-t-0 @3xl:border-l"
          >
            <div
              ref={scroller}
              className="max-h-72 overflow-y-auto [scrollbar-width:thin] @3xl:absolute @3xl:inset-0 @3xl:max-h-none"
            >
              <p className="sticky top-0 z-10 border-b bg-card px-4 py-2.5 text-sm text-muted-foreground">
                {videos.length} lectures
              </p>
              <ol>
                {videos.map((v, i) => {
                  const current = i === index;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        aria-current={current || undefined}
                        onClick={() => {
                          setActive(i);
                          setChosen(true);
                        }}
                        className={cn(
                          "grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-l-[3px] py-2.5 pr-4 pl-[13px] text-left transition-colors",
                          current
                            ? "border-l-primary bg-muted"
                            : "border-l-transparent hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "pt-px font-heading text-sm font-semibold tabular-nums",
                            current ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "line-clamp-2 text-sm leading-snug",
                              current ? "font-medium" : "text-foreground/80",
                            )}
                          >
                            {shortTitle(v.title)}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {v.channel}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
