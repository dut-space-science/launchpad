import { useRef } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Bigger thumb and track than the default slider, so it is easy to grab with a mouse or finger. */
const BIG_SLIDER =
  "[&_[data-slot=slider-thumb]]:size-6! [&_[data-slot=slider-track]]:h-2.5! [&_[data-slot=slider-track]]:rounded-full";

function useVolumeIcon(value: number, onChange: (v: number) => void) {
  const before = useRef(value > 0 ? value : 50);
  if (value > 0) before.current = value;
  return {
    Icon: value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2,
    toggleMute: () => onChange(value === 0 ? before.current : 0),
  };
}

function Level({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <Slider
      aria-label={`${label} volume`}
      value={[value]}
      min={0}
      max={100}
      step={1}
      onValueChange={(v) => onChange(Array.isArray(v) ? (v as number[])[0] : (v as number))}
      className={cn("flex-1 py-2", BIG_SLIDER)}
    />
  );
}

/** Compact: a speaker button. Selecting it opens a popover with a large slider and a mute button. */
export function VolumeControl({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  const { Icon, toggleMute } = useVolumeIcon(value, onChange);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-9", className)}
            aria-label={`${label} volume, ${value} percent`}
            title={`${label} volume: ${value}%`}
          />
        }
      >
        <Icon className="size-5" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{label}</span>
          <span className="text-lg font-semibold tabular-nums">{value}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            aria-label={value === 0 ? `Unmute ${label}` : `Mute ${label}`}
            aria-pressed={value === 0}
            onClick={toggleMute}
          >
            <Icon className="size-5" />
          </Button>
          <Level value={value} onChange={onChange} label={label} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Always visible: a full-width large slider with a mute button and the level. Used on the Settings page. */
export function VolumeSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const { Icon, toggleMute } = useVolumeIcon(value, onChange);
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        aria-label={value === 0 ? `Unmute ${label}` : `Mute ${label}`}
        aria-pressed={value === 0}
        onClick={toggleMute}
      >
        <Icon className="size-5" />
      </Button>
      <Level value={value} onChange={onChange} label={label} />
      <span className="w-14 shrink-0 text-right text-lg font-semibold tabular-nums">{value}%</span>
    </div>
  );
}

/** The original compact inline control (mute button, small slider, level). Used in the study music mini player. */
export function VolumeInline({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  const { Icon, toggleMute } = useVolumeIcon(value, onChange);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={value === 0 ? `Unmute ${label}` : `Mute ${label}`}
        aria-pressed={value === 0}
        onClick={toggleMute}
      >
        <Icon />
      </Button>
      <Slider
        aria-label={`${label} volume`}
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(Array.isArray(v) ? (v as number[])[0] : (v as number))}
        className="w-28"
      />
      <span className="w-8 text-right text-sm text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}
