import { useMemo, useRef, useState } from "react";
import { FileUp, Wand2 } from "lucide-react";
import { LineChart } from "@/components/line-chart";
import { LabShell, NumField, Stat } from "@/components/lab-ui";
import { Button } from "@/components/ui/button";
import { rms, welch } from "@/lib/dsp";
import { fmt } from "@/lib/format";

function parseCsv(text: string): { y: number[]; fsGuess?: number } {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[,;\t ]+/).map(Number));
  const num = rows.filter((r) => r.every((v) => Number.isFinite(v)) && r.length > 0);
  if (!num.length) return { y: [] };
  if (num[0].length >= 2) {
    const t = num.map((r) => r[0]);
    const dt = (t[t.length - 1] - t[0]) / (t.length - 1);
    return { y: num.map((r) => r[1]), fsGuess: dt > 0 ? Math.round(1 / dt) : undefined };
  }
  return { y: num.map((r) => r[0]) };
}

function demo(fs: number) {
  const n = fs * 4;
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5;
  return Array.from({ length: n }, (_, i) => {
    const t = i / fs;
    return (
      1.5 * Math.sin(2 * Math.PI * 120 * t) +
      0.8 * Math.sin(2 * Math.PI * 800 * t) +
      3 * (rnd() + rnd() + rnd())
    );
  });
}

export function PsdAnalyzerLab() {
  const [y, setY] = useState<number[]>(() => demo(10000));
  const [fs, setFs] = useState(10000);
  const [nseg, setNseg] = useState(1024);
  const [name, setName] = useState("Demo signal (120 Hz + 800 Hz + noise)");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const res = useMemo(() => (y.length > 16 && fs > 0 ? welch(y, fs, nseg) : null), [y, fs, nseg]);
  const t = useMemo(
    () => Array.from({ length: Math.min(y.length, Math.ceil(fs * 0.1)) }, (_, i) => i / fs),
    [y, fs],
  );
  const peakF = res ? res.f[res.psd.indexOf(Math.max(...Array.from(res.psd).slice(1)))] : NaN;
  const clip = y.length ? y.filter((v) => Math.abs(v) === Math.max(...y.map(Math.abs))).length : 0;

  async function load(file?: File) {
    if (!file) return;
    const { y: ny, fsGuess } = parseCsv(await file.text());
    if (ny.length < 32) {
      setErr("Could not find at least 32 numeric samples.");
      return;
    }
    setErr("");
    setY(ny);
    setName(file.name);
    if (fsGuess) setFs(fsGuess);
  }
  return (
    <LabShell
      title="PSD analyser for your own data"
      blurb="Runs entirely in your browser. CSV: one column of acceleration, or two columns (time, acceleration)."
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => input.current?.click()}>
              <FileUp /> Load CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setY(demo(fs));
                setName("Demo signal (120 Hz + 800 Hz + noise)");
                setErr("");
              }}
            >
              <Wand2 /> Demo signal
            </Button>
            <input
              ref={input}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              onChange={(e) => load(e.target.files?.[0])}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="truncate text-xs text-muted-foreground">
            {name} · {y.length.toLocaleString()} samples
          </p>
          <NumField label="Sample rate" unit="Hz" value={fs} onChange={setFs} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Segment length (frequency resolution)</span>
            <select
              value={nseg}
              onChange={(e) => setNseg(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {[256, 512, 1024, 2048, 4096, 8192].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {fs > 0 ? ` (Δf ≈ ${fmt(fs / n, 3)} Hz)` : ""}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {res && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Grms (mean removed)"
              value={fmt(rms(y.map((v) => v - y.reduce((a, b) => a + b, 0) / y.length)), 4)}
            />
            <Stat
              label="Peak |a|"
              value={fmt(Math.max(...y.map(Math.abs)), 4)}
              hint={clip > 3 ? `${clip} samples at peak: clipping?` : undefined}
              tone={clip > 3 ? "warn" : undefined}
            />
            <Stat label="Dominant line" value={`${fmt(peakF, 4)} Hz`} />
            <Stat
              label="Averages / Δf"
              value={`${res.segs} / ${fmt(res.df, 3)} Hz`}
              tone={res.segs < 10 ? "warn" : "good"}
            />
          </div>
          <LineChart
            height={170}
            xLabel="Time (s), first 0.1 s"
            yLabel="Acceleration"
            series={[{ name: "time history", x: t, y: y.slice(0, t.length), width: 1 }]}
          />
          <LineChart
            xLog
            yLog
            xLabel="Frequency (Hz)"
            yLabel="PSD (units²/Hz)"
            series={[
              { name: "Welch PSD", x: Array.from(res.f).slice(1), y: Array.from(res.psd).slice(1) },
            ]}
          />
        </>
      )}
    </LabShell>
  );
}
