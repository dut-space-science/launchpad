export type StreamKind = "video" | "playlist";
export interface Stream {
  id: string;
  label: string;
  kind: StreamKind;
  ref: string; // YouTube video id or playlist id
}

/** Accepts a watch/live/share/embed/playlist link, or a bare 11-character video id. */
export function parseSource(input: string): { kind: StreamKind; ref: string } | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[\w-]{11}$/.test(v)) return { kind: "video", ref: v };
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (!/(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/.test(u.hostname))
      return null;
    const list = u.searchParams.get("list");
    const vid =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1, 12)
        : (u.searchParams.get("v") ??
          u.pathname.match(/\/(?:live|embed|shorts)\/([\w-]{11})/)?.[1]);
    if (vid && /^[\w-]{11}$/.test(vid)) return { kind: "video", ref: vid };
    if (list) return { kind: "playlist", ref: list };
  } catch {
    /* not a URL */
  }
  return null;
}

export const embedUrl = (s: Pick<Stream, "kind" | "ref">) =>
  s.kind === "playlist"
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(s.ref)}&autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.ref)}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;

/** Best-effort title lookup; the learner can always rename. Returns null if the lookup is blocked or fails. */
export async function fetchTitle(s: Pick<Stream, "kind" | "ref">): Promise<string | null> {
  try {
    const url =
      s.kind === "playlist"
        ? `https://www.youtube.com/playlist?list=${s.ref}`
        : `https://www.youtube.com/watch?v=${s.ref}`;
    const r = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { title?: string };
    return d.title ?? null;
  } catch {
    return null;
  }
}

/**
 * Send a command to a YouTube embed that was loaded with enablejsapi=1. This uses the documented postMessage
 * protocol, so no extra script is needed. Commands sent before the player is ready are ignored.
 */
export function ytCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}

/** Set a volume (0 to 100). The player may still be starting, so retry a few times after load. */
export function setYtVolume(frame: HTMLIFrameElement | null, volume: number) {
  const send = () => {
    ytCommand(frame, "setVolume", [volume]);
    ytCommand(frame, volume === 0 ? "mute" : "unMute");
  };
  send();
  [400, 1200, 2500].forEach((ms) => window.setTimeout(send, ms));
}
