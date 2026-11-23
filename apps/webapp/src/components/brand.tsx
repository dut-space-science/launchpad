import { cn } from "@/lib/utils";

/** Launchpad mark: a bright green tile with an upward chevron. Neutral, scales down cleanly. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M9 21l7-11 7 11"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 25h7"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Brand({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className="block font-heading text-lg font-semibold tracking-tight">Launchpad</span>
        {tagline && (
          <span className="block text-xs text-muted-foreground">DUT Space Science Centre</span>
        )}
      </span>
    </span>
  );
}
