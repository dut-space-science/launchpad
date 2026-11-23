import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { logspace } from "@/lib/dsp";
import { fmt } from "@/lib/format";

const T = (r: number, z: number) =>
  Math.sqrt((1 + (2 * z * r) ** 2) / ((1 - r * r) ** 2 + (2 * z * r) ** 2));

export function TransmissibilityLab() {
  const [zeta, setZeta] = useState(0.05);
  const [fn, setFn] = useState(100);
  const [fin, setFin] = useState(400);
  const r = useMemo(() => logspace(0.1, 10, 400), []);
  const compare = [0.01, 0.05, 0.2, 0.5];
  const series = [
    { name: `your ζ = ${fmt(zeta, 2)}`, x: r, y: r.map((v) => T(v, zeta)), width: 2.5 },
    ...compare.map((z, i) => ({
      name: `ζ = ${z}`,
      x: r,
      y: r.map((v) => T(v, z)),
      color: ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"][i],
      width: 1,
      dashed: true,
    })),
  ];
  const rin = fin / fn;
  const t = T(rin, zeta);
  return (
    <LabShell
      title="base-excitation transmissibility"
      blurb="Response/input amplitude ratio versus frequency ratio r = f/fn."
      controls={
        <>
          <Param label="Damping ratio ζ" value={zeta} onChange={setZeta} min={0.005} max={1} log />
          <Param
            label="Mount natural frequency fn"
            unit="Hz"
            value={fn}
            onChange={setFn}
            min={5}
            max={2000}
            log
          />
          <Param
            label="Input frequency"
            unit="Hz"
            value={fin}
            onChange={setFin}
            min={5}
            max={5000}
            log
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="r = f/fn" value={fmt(rin, 3)} />
            <Stat
              label="Transmissibility"
              value={fmt(t, 3)}
              tone={t > 1.2 ? "bad" : t < 0.9 ? "good" : "warn"}
              hint={t > 1 ? "amplifies" : "isolates"}
            />
            <Stat label="Peak ≈ Q" value={fmt(1 / (2 * zeta), 3)} />
            <Stat label="Isolates above" value={`${fmt(fn * Math.SQRT2, 3)} Hz`} />
          </div>
        </>
      }
    >
      <LineChart
        xLog
        yLog
        xLabel="Frequency ratio r = f/fn"
        yLabel="Transmissibility"
        vlines={[
          { x: 1, label: "resonance" },
          { x: Math.SQRT2, label: "√2", color: "var(--chart-2)" },
          { x: Math.min(10, Math.max(0.1, rin)), label: "input", color: "var(--foreground)" },
        ]}
        series={series}
      />
    </LabShell>
  );
}
