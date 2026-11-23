import { useEffect, useRef, useState } from "react";
import { Focus, ExternalLink, Play } from "lucide-react";
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
export function YouTubeEmbed({ video }: { video: Video }) {
  const [on, setOn] = useState(false);
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
