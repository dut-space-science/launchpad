import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { fmt } from "@/lib/format";

export function LabShell({
  title,
  blurb,
  controls,
  children,
  footer,
}: {
  title: string;
  blurb?: string;
  controls: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="not-prose my-6 border-gold/40 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-gold" /> Interactive lab: {title}
        </CardTitle>
        {blurb && <CardDescription>{blurb}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="space-y-4">{controls}</div>
        <div className="min-w-0 space-y-3">{children}</div>
      </CardContent>
      {footer && <CardContent className="text-sm text-muted-foreground">{footer}</CardContent>}
    </Card>
  );
}

/** Slider with label and live value. `log` makes the slider logarithmic. */
export function Param({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit,
  log,
  digits = 3,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  log?: boolean;
  digits?: number;
}) {
  const to = (v: number) => (log ? Math.log10(v) : v);
  const from = (v: number) => (log ? 10 ** v : v);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {fmt(value, digits)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[to(value)]}
        min={to(min)}
        max={to(max)}
        step={log ? 0.01 : step}
        onValueChange={(v) => onChange(from(Array.isArray(v) ? (v as number[])[0] : (v as number)))}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const c =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-chart-2"
        : tone === "good"
          ? "text-success"
          : "";
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg font-semibold ${c}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  unit,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">
        {label}
        {unit ? <span className="font-normal text-muted-foreground"> ({unit})</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step ?? "any"}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </label>
  );
}
