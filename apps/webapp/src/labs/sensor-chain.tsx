import { useState } from "react";
import { LabShell, NumField, Stat } from "@/components/lab-ui";
import { fmt, bytes } from "@/lib/format";

const RANGES = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export function SensorChainLab() {
  const [peak, setPeak] = useState(120);
  const [margin, setMargin] = useState(1.5);
  const [bw, setBw] = useState(10000);
  const [ch, setCh] = useState(4);
  const [bits, setBits] = useState(16);
  const [vfs, setVfs] = useState(5);
  const [sens, setSens] = useState(10);
  const [dur, setDur] = useState(120);
  const need = peak * margin;
  const range = RANGES.find((r) => r >= need) ?? NaN;
  const fs = 2.56 * bw;
  const fsRound = Math.ceil(fs / 1000) * 1000;
  const vpeak = (range * sens) / 1000; // V at full range
  const lsbG = (2 * vfs) / 2 ** bits / (sens / 1000);
  const use = vpeak / vfs;
  const rate = ch * fsRound * Math.ceil(bits / 8);
  return (
    <LabShell
      title="sensor-chain sizing"
      blurb="From expected peak and bandwidth to range, sample rate, resolution and data volume. Use as the starting point of your capstone plan."
      controls={
        <>
          <NumField label="Expected peak acceleration" unit="g" value={peak} onChange={setPeak} />
          <NumField label="Safety margin factor" value={margin} onChange={setMargin} step={0.1} />
          <NumField label="Required bandwidth" unit="Hz" value={bw} onChange={setBw} />
          <NumField label="Accelerometer sensitivity" unit="mV/g" value={sens} onChange={setSens} />
          <div className="grid grid-cols-2 gap-2">
            <NumField label="ADC bits" value={bits} onChange={setBits} />
            <NumField label="ADC ±range" unit="V" value={vfs} onChange={setVfs} />
            <NumField label="Channels" value={ch} onChange={setCh} />
            <NumField label="Record length" unit="s" value={dur} onChange={setDur} />
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Required range" value={`±${fmt(need, 3)} g`} hint="peak × margin" />
        <Stat
          label="Pick sensor range"
          value={Number.isFinite(range) ? `±${range} g` : "> 10 kg"}
        />
        <Stat label="Min sample rate" value={`${fmt(fs, 5)} Hz`} hint="2.56 × bandwidth" />
        <Stat label="Suggested fs" value={`${fmt(fsRound / 1000, 3)} kS/s`} />
        <Stat label="ADC resolution" value={`${fmt(lsbG * 1000, 3)} mg/LSB`} />
        <Stat
          label="ADC range used"
          value={`${fmt(use * 100, 3)} %`}
          tone={use > 0.95 ? "bad" : use < 0.2 ? "warn" : "good"}
          hint={
            use > 0.95 ? "risk of clipping" : use < 0.2 ? "low: resolution wasted" : "good headroom"
          }
        />
        <Stat label="Data rate" value={`${bytes(rate)}/s`} />
        <Stat label="File size" value={bytes(rate * dur)} />
        <Stat label="Anti-alias corner" value={`≈ ${fmt(bw, 4)} Hz`} hint="steep ≥ 4th order" />
      </div>
      <p className="text-xs text-muted-foreground">
        Rules: the sensor range must cover peak × margin; ADC range used should be roughly 20–95%;
        sample at ≥ 2.56 × bandwidth behind an analogue anti-alias filter. For shock, use ≥ 10 × the
        highest frequency of interest.
      </p>
    </LabShell>
  );
}
