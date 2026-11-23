import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { logspace } from "@/lib/dsp";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

// Indicative fractions of the datasheet (stud-mounted) resonance. Check your own sensor's datasheet.
const MOUNTS = {
  "Stud (reference)": 1,
  "Thin adhesive": 0.6,
  "Adhesive wax": 0.3,
  Magnet: 0.25,
  "Hand-held probe": 0.04,
} as const;

export function MountingLab() {
  const [res, setRes] = useState(30);
  const [mount, setMount] = useState<keyof typeof MOUNTS>("Stud (reference)");
  const [zeta, setZeta] = useState(0.02);
  const fm = res * 1000 * MOUNTS[mount];
  const f = logspace(10, 100000, 400);
  const resp = (fr: number) =>
    1 / Math.sqrt((1 - (fr / fm) ** 2) ** 2 + (2 * zeta * (fr / fm)) ** 2);
  const usable = (tol: number) => {
    let lo = 0.001,
      hi = 0.999;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (resp(m * fm) - 1 > tol) hi = m;
      else lo = m;
    }
    return lo * fm;
  };
  const u5 = usable(0.05),
    u10 = usable(0.1);
  return (
    <LabShell
      title="mounted resonance and usable bandwidth"
      blurb="A sensor's response is flat well below its mounted resonance, then peaks. Mounting scales that resonance down (indicative factors only)."
      controls={
        <>
          <Param
            label="Datasheet mounted resonance (stud)"
            unit="kHz"
            value={res}
            onChange={setRes}
            min={2}
            max={100}
            log
          />
          <div className="space-y-1.5" role="radiogroup" aria-label="Mounting method">
            {(Object.keys(MOUNTS) as (keyof typeof MOUNTS)[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={mount === k}
                onClick={() => setMount(k)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-md border px-3 py-1.5 text-sm",
                  mount === k ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
                )}
              >
                <span>{k}</span>
                <span className="font-mono text-xs text-muted-foreground">×{MOUNTS[k]}</span>
              </button>
            ))}
          </div>
          <Param
            label="Sensor damping ζ"
            value={zeta}
            onChange={setZeta}
            min={0.005}
            max={0.3}
            log
          />
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Mounted resonance" value={`${fmt(fm / 1000, 3)} kHz`} />
        <Stat label="Usable to ±5%" value={`${fmt(u5, 3)} Hz`} />
        <Stat label="Usable to ±10%" value={`${fmt(u10, 3)} Hz`} />
      </div>
      <LineChart
        xLog
        xLabel="Frequency (Hz)"
        yLabel="Response / true (×)"
        yDomain={[0, 4]}
        vlines={[
          { x: fm, label: "resonance", color: "var(--chart-3)" },
          { x: u5, label: "±5%", color: "var(--chart-1)" },
        ]}
        series={[{ name: "sensor response", x: f, y: f.map(resp) }]}
      />
    </LabShell>
  );
}
