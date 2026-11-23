import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { linspace } from "@/lib/dsp";
import { fmt } from "@/lib/format";

export function FreeDecayLab() {
  const [fn, setFn] = useState(5);
  const [zeta, setZeta] = useState(0.05);
  const wn = 2 * Math.PI * fn;
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  const T = 1 / (fn * Math.sqrt(1 - zeta * zeta));
  const tEnd = Math.min(12 / fn, Math.max(4 / fn, 4 / (zeta * wn)));
  const { t, x, env, neg } = useMemo(() => {
    const t = linspace(0, tEnd, 800);
    const x = t.map(
      (s) => Math.exp(-zeta * wn * s) * (Math.cos(wd * s) + ((zeta * wn) / wd) * Math.sin(wd * s)),
    );
    const env = t.map((s) => Math.exp(-zeta * wn * s));
    return { t, x, env, neg: env.map((v) => -v) };
  }, [tEnd, zeta, wn, wd]);
  const delta = (2 * Math.PI * zeta) / Math.sqrt(1 - zeta * zeta);
  return (
    <LabShell
      title="free decay of an SDOF oscillator"
      blurb="Initial displacement of 1, released from rest."
      controls={
        <>
          <Param
            label="Natural frequency fn"
            unit="Hz"
            value={fn}
            onChange={setFn}
            min={0.5}
            max={50}
            log
          />
          <Param
            label="Damping ratio ζ"
            value={zeta}
            onChange={setZeta}
            min={0.002}
            max={0.9}
            log
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Q ≈ 1/2ζ" value={fmt(1 / (2 * zeta), 3)} />
            <Stat label="Log decrement δ" value={fmt(delta, 3)} hint="ln(x₁/x₂)" />
            <Stat label="Damped fd" value={`${fmt(wd / (2 * Math.PI), 4)} Hz`} />
            <Stat label="Period" value={`${fmt(T * 1000, 4)} ms`} />
          </div>
        </>
      }
    >
      <LineChart
        xLabel="Time (s)"
        yLabel="Displacement"
        series={[
          { name: "x(t)", x: t, y: x },
          { name: "+envelope", x: t, y: env, color: "var(--chart-3)", dashed: true, width: 1.5 },
          { name: "−envelope", x: t, y: neg, color: "var(--chart-3)", dashed: true, width: 1.5 },
        ]}
      />
    </LabShell>
  );
}
