import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, NumField, Param, Stat } from "@/components/lab-ui";
import { Button } from "@/components/ui/button";
import { logspace, psdArea, psdAt } from "@/lib/dsp";
import { fmt } from "@/lib/format";

type Pt = [number, number];
const PRESETS: Record<string, Pt[]> = {
  "Generic flat (illustrative)": [
    [20, 0.01],
    [50, 0.04],
    [800, 0.04],
    [2000, 0.01],
  ],
  "Low-level workmanship (illustrative)": [
    [20, 0.005],
    [100, 0.02],
    [500, 0.02],
    [2000, 0.005],
  ],
  "Engine-like, rising (illustrative)": [
    [20, 0.002],
    [200, 0.05],
    [1000, 0.05],
    [2000, 0.01],
  ],
};

export function PsdGrmsLab() {
  const [pts, setPts] = useState<Pt[]>(PRESETS["Generic flat (illustrative)"]);
  const [fn, setFn] = useState(200);
  const [Q, setQ] = useState(10);
  const grms = Math.sqrt(psdArea(pts));
  const fgrid = useMemo(() => logspace(pts[0][0], pts[pts.length - 1][0], 300), [pts]);
  const w = psdAt(pts, fn);
  const miles = Math.sqrt((Math.PI / 2) * fn * Q * w);
  const set = (i: number, j: 0 | 1, v: number) =>
    setPts((p) => p.map((q, k) => (k === i ? ((j === 0 ? [v, q[1]] : [q[0], v]) as Pt) : q)));
  const valid = pts.every(([f, v], i) => f > 0 && v > 0 && (i === 0 || f > pts[i - 1][0]));
  const slopes = pts
    .slice(1)
    .map((q, i) => (10 * Math.log10(q[1] / pts[i][1])) / Math.log2(q[0] / pts[i][0]));
  return (
    <LabShell
      title="PSD breakpoints → Grms → resonant response"
      blurb="Edit the breakpoints (Hz, g²/Hz). Preset values are illustrative, not from any standard."
      controls={
        <>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PRESETS).map((k) => (
              <Button key={k} size="sm" variant="outline" onClick={() => setPts(PRESETS[k])}>
                {k.split(" (")[0]}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            {pts.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <NumField
                  label={`f${i + 1}`}
                  unit="Hz"
                  value={p[0]}
                  onChange={(v) => set(i, 0, v)}
                />
                <NumField
                  label={`PSD${i + 1}`}
                  unit="g²/Hz"
                  value={p[1]}
                  onChange={(v) => set(i, 1, v)}
                  step={0.001}
                />
              </div>
            ))}
          </div>
          <Param
            label="Part natural frequency fn"
            unit="Hz"
            value={fn}
            onChange={setFn}
            min={pts[0][0]}
            max={pts[pts.length - 1][0]}
            log
          />
          <Param label="Quality factor Q" value={Q} onChange={setQ} min={1} max={100} log />
        </>
      }
    >
      {!valid ? (
        <p className="text-sm text-destructive">
          Frequencies must increase and PSD values must be positive.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Overall Grms" value={fmt(grms, 4)} />
            <Stat label="3σ peak" value={`${fmt(3 * grms, 4)} g`} />
            <Stat label="PSD at fn" value={fmt(w, 3)} hint="g²/Hz" />
            <Stat
              label="Miles response"
              value={`${fmt(miles, 4)} Grms`}
              hint={`×${fmt(miles / grms, 3)} of input`}
            />
          </div>
          <LineChart
            xLog
            yLog
            xLabel="Frequency (Hz)"
            yLabel="PSD (g²/Hz)"
            vlines={[{ x: fn, label: "fn", color: "var(--chart-3)" }]}
            series={[{ name: "PSD", x: fgrid, y: fgrid.map((f) => psdAt(pts, f)) }]}
          />
          <p className="text-xs text-muted-foreground">
            Segment slopes:{" "}
            {slopes.map((s) => `${s >= 0 ? "+" : ""}${fmt(s, 3)} dB/oct`).join(" · ")}. Margin +3 dB
            would give Grms {fmt(grms * Math.SQRT2, 4)}.
          </p>
        </>
      )}
    </LabShell>
  );
}
