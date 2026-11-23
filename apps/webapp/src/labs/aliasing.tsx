import { useMemo, useState } from "react";
import { LineChart } from "@/components/line-chart";
import { LabShell, Param, Stat } from "@/components/lab-ui";
import { aliasOf, linspace } from "@/lib/dsp";
import { fmt } from "@/lib/format";

export function AliasingLab() {
  const [f, setF] = useState(900);
  const [fs, setFs] = useState(1000);
  const fa = aliasOf(f, fs);
  const { tc, xc, ts, xs, xa } = useMemo(() => {
    const dur = Math.min(Math.max(3 / f, 4 / Math.max(fa, 1)), 300 / fs);
    const tc = linspace(0, dur, 1200);
    const xc = tc.map((t) => Math.sin(2 * Math.PI * f * t));
    const N = Math.floor(dur * fs);
    const ts = Array.from({ length: N + 1 }, (_, i) => i / fs);
    const xs = ts.map((t) => Math.sin(2 * Math.PI * f * t));
    const xa = tc.map((t) => Math.sin(2 * Math.PI * fa * t));
    return { tc, xc, ts, xs, xa };
  }, [f, fs, fa]);
  const aliased = f > fs / 2;
  return (
    <LabShell
      title="sampling and aliasing"
      blurb="A tone is sampled; the dots are all the ADC knows. If f > fs/2 an impostor tone fits them equally well."
      controls={
        <>
          <Param
            label="Signal frequency f"
            unit="Hz"
            value={f}
            onChange={setF}
            min={10}
            max={20000}
            log
          />
          <Param
            label="Sample rate fs"
            unit="Hz"
            value={fs}
            onChange={setFs}
            min={100}
            max={50000}
            log
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nyquist fs/2" value={`${fmt(fs / 2, 4)} Hz`} />
            <Stat
              label="Appears at"
              value={`${fmt(fa, 4)} Hz`}
              tone={aliased ? "bad" : "good"}
              hint={aliased ? "ALIASED" : "correct"}
            />
            <Stat label="Min fs (2.56×)" value={`${fmt(2.56 * f, 4)} Hz`} />
            <Stat label="Samples/period" value={fmt(fs / f, 3)} />
          </div>
        </>
      }
    >
      <LineChart
        xLabel="Time (s)"
        yLabel="Amplitude"
        markers
        series={[
          { name: "samples", x: ts, y: xs, color: "var(--chart-1)", width: 0 },
          { name: "true signal", x: tc, y: xc, color: "var(--chart-2)", width: 1.2 },
          ...(aliased
            ? [
                {
                  name: "alias that fits the samples",
                  x: tc,
                  y: xa,
                  color: "var(--chart-3)",
                  dashed: true,
                  width: 2,
                },
              ]
            : []),
        ]}
      />
    </LabShell>
  );
}
