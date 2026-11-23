import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { logspace } from "@/lib/dsp";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

const FLUIDS = {
  "LOX (1141 kg/m³)": 1141,
  "RP-1 / kerosene (810)": 810,
  "Water (1000)": 1000,
  "Liquid N₂O (~750)": 750,
} as const;

export function PogoLab() {
  const [fluid, setFluid] = useState<keyof typeof FLUIDS>("LOX (1141 kg/m³)");
  const [L, setL] = useState(3);
  const [dia, setDia] = useState(40);
  const [vol, setVol] = useState(0.5);
  const [p, setP] = useState(8);
  const [fs, setFs] = useState(25);
  const [on, setOn] = useState(true);
  const rho = FLUIDS[fluid];
  const area = (Math.PI * (dia / 1000) ** 2) / 4;
  const I = (rho * L) / area; // kg/m^4
  const gamma = 1.4;
  const Cgas = on ? vol / 1000 / (gamma * p * 1e5) : 0;
  const Cfloor = 2e-13; // small residual line/ullage compliance so f stays finite without an accumulator
  const C = Cgas + Cfloor;
  const ff = 1 / (2 * Math.PI * Math.sqrt(I * C));
  const ratio = ff / fs;
  const zone = ratio > 0.75 && ratio < 1.35 ? "bad" : ratio > 0.55 && ratio < 1.8 ? "warn" : "good";
  const f = useMemo(() => logspace(2, 500, 300), []);
  const zf = 0.05; // assumed light feed-line damping
  const gain = f.map((x) => 1 / Math.sqrt((1 - (x / ff) ** 2) ** 2 + (2 * zf * (x / ff)) ** 2));
  return (
    <LabShell
      title="feed-line frequency vs structural mode"
      blurb="Educational: liquid inertance + gas compliance (accumulator) vs the vehicle's first axial mode."
      controls={
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Propellant</span>
            <select
              value={fluid}
              onChange={(e) => setFluid(e.target.value as keyof typeof FLUIDS)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {Object.keys(FLUIDS).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <Param label="Line length" unit="m" value={L} onChange={setL} min={0.2} max={20} log />
          <Param
            label="Line inner diameter"
            unit="mm"
            value={dia}
            onChange={setDia}
            min={8}
            max={200}
            log
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="accent-[var(--primary)]"
            />{" "}
            Gas accumulator fitted
          </label>
          <Param
            label="Accumulator gas volume"
            unit="L"
            value={vol}
            onChange={setVol}
            min={0.01}
            max={20}
            log
          />
          <Param label="Gas pressure" unit="bar" value={p} onChange={setP} min={1} max={100} log />
          <Param
            label="Structure first axial mode"
            unit="Hz"
            value={fs}
            onChange={setFs}
            min={5}
            max={100}
            log
          />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Inertance I" value={`${fmt(I, 3)} kg/m⁴`} />
        <Stat label="Compliance C" value={`${fmt(C, 3)} m³/Pa`} />
        <Stat label="f_feed" value={`${fmt(ff, 3)} Hz`} />
        <Stat
          label="f_feed / f_struct"
          value={fmt(ratio, 3)}
          tone={zone === "bad" ? "bad" : zone === "warn" ? "warn" : "good"}
        />
      </div>
      <p
        className={cn(
          "rounded-lg border p-3 text-sm",
          zone === "bad"
            ? "border-destructive/50 bg-destructive/5"
            : zone === "warn"
              ? "border-gold/60 bg-gold/10"
              : "border-success/50 bg-success/10",
        )}
      >
        {zone === "bad"
          ? "Coincidence zone: feed-system and structural frequencies are close. This is the risky configuration for pogo. Detune (change line, add or resize the accumulator) or add damping."
          : zone === "warn"
            ? "Marginal separation: acceptable only with a proper stability analysis."
            : "Good separation in this simple model. A real analysis still needs the engine gain and structural damping."}
      </p>
      <LineChart
        xLog
        yLog
        xLabel="Frequency (Hz)"
        yLabel="Feed-system resonance magnitude"
        vlines={[
          { x: fs, label: "structure", color: "var(--chart-3)" },
          { x: ff, label: "feed", color: "var(--chart-1)" },
        ]}
        series={[{ name: "feed-line response", x: f, y: gain }]}
      />
    </LabShell>
  );
}
