import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { logspace, srs } from "@/lib/dsp";
import { fmt } from "@/lib/format";

export function SrsLab() {
  const [A, setA] = useState(100);
  const [ms, setMs] = useState(1);
  const [Q, setQ] = useState(10);
  const dt = Math.min(2e-6, ms / 1000 / 200);
  const { t, a, f, s } = useMemo(() => {
    const tau = ms / 1000;
    const tEnd = Math.max(0.05, tau * 20);
    const n = Math.min(60000, Math.ceil(tEnd / dt));
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = i * dt < tau ? A * Math.sin((Math.PI * i * dt) / tau) : 0;
    const f = logspace(10, 10000, 60);
    const t = Array.from(
      { length: Math.min(n, Math.ceil((tau * 3) / dt)) },
      (_, i) => i * dt * 1000,
    );
    return { t, a: Array.from(a.slice(0, t.length)), f, s: srs(a, dt, f, Q) };
  }, [A, ms, Q, dt]);
  const peak = Math.max(...s);
  const fpk = f[s.indexOf(peak)];
  return (
    <LabShell
      title="SRS of a half-sine shock"
      blurb="Peak absolute response of a bank of SDOF oscillators driven by the pulse (maximax)."
      controls={
        <>
          <Param
            label="Pulse amplitude"
            unit="g"
            value={A}
            onChange={setA}
            min={5}
            max={5000}
            log
          />
          <Param
            label="Pulse duration"
            unit="ms"
            value={ms}
            onChange={setMs}
            min={0.05}
            max={20}
            log
          />
          <Param label="Q" value={Q} onChange={setQ} min={2} max={50} log />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Peak SRS" value={`${fmt(peak, 4)} g`} hint={`at ${fmt(fpk, 3)} Hz`} />
            <Stat label="SRS / pulse peak" value={fmt(peak / A, 3)} />
          </div>
        </>
      }
    >
      <LineChart
        height={190}
        xLabel="Time (ms)"
        yLabel="Base acceleration (g)"
        series={[{ name: "pulse", x: t, y: a }]}
      />
      <LineChart
        xLog
        yLog
        xLabel="Oscillator frequency (Hz)"
        yLabel="SRS (g)"
        series={[
          { name: `SRS Q=${fmt(Q, 2)}`, x: f, y: s },
          {
            name: "pulse peak",
            x: [10, 10000],
            y: [A, A],
            color: "var(--chart-3)",
            dashed: true,
            width: 1.2,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Notice: a shorter pulse pushes the knee to a higher frequency; the high-frequency plateau
        stays near the pulse peak; the low-frequency side rises with slope ≈ +1 (+6 dB/oct).
      </p>
    </LabShell>
  );
}
