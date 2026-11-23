import { useState } from "react";
import { LabShell, NumField, Stat } from "@/components/lab-ui";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

type BC = "cantilever" | "free" | "pinned";
const BETA: Record<BC, number[]> = {
  cantilever: [1.8751, 4.6941, 7.8548],
  free: [4.73, 7.8532, 10.9956],
  pinned: [Math.PI, 2 * Math.PI, 3 * Math.PI],
};
const MAT = {
  Aluminium: [70e9, 2700],
  Steel: [200e9, 7850],
  "CFRP (quasi-iso)": [60e9, 1550],
  Titanium: [110e9, 4500],
} as const;

export function BeamModesLab() {
  const [bc, setBc] = useState<BC>("free");
  const [mat, setMat] = useState<keyof typeof MAT>("Aluminium");
  const [L, setL] = useState(3);
  const [od, setOd] = useState(150);
  const [wall, setWall] = useState(2);
  const [E, rho] = MAT[mat];
  const ro = od / 2000;
  const ri = Math.max(0, ro - wall / 1000);
  const A = Math.PI * (ro ** 2 - ri ** 2);
  const I = (Math.PI / 4) * (ro ** 4 - ri ** 4);
  const f = BETA[bc].map((b) => ((b * b) / (2 * Math.PI * L * L)) * Math.sqrt((E * I) / (rho * A)));
  const axial = (1 / (4 * L)) * Math.sqrt(E / rho);
  const mass = rho * A * L;
  const invalid = !(L > 0 && od > 0 && wall > 0 && wall < od / 2);
  return (
    <LabShell
      title="uniform tube: bending and axial modes"
      blurb="Euler–Bernoulli hand check. Ignores payloads, joints, shear and propellant."
      controls={
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Boundary condition">
            {(["free", "cantilever", "pinned"] as BC[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={bc === k}
                onClick={() => setBc(k)}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium",
                  bc === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {k === "free" ? "Free–free" : k === "cantilever" ? "Cantilever" : "Pinned–pinned"}
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Material</span>
            <select
              value={mat}
              onChange={(e) => setMat(e.target.value as keyof typeof MAT)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {Object.keys(MAT).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <NumField label="Length L" unit="m" value={L} onChange={setL} step={0.1} />
          <NumField label="Outer diameter" unit="mm" value={od} onChange={setOd} />
          <NumField label="Wall thickness" unit="mm" value={wall} onChange={setWall} step={0.1} />
        </>
      }
    >
      {invalid ? (
        <p className="text-sm text-destructive">Check inputs: wall must be less than the radius.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {f.map((v, i) => (
              <Stat key={i} label={`Bending mode ${i + 1}`} value={`${fmt(v, 4)} Hz`} />
            ))}
            <Stat
              label="1st axial (fixed–free rod)"
              value={`${fmt(axial, 4)} Hz`}
              hint="(1/4L)·√(E/ρ)"
            />
            <Stat label="Tube mass" value={`${fmt(mass, 3)} kg`} />
            <Stat
              label="Slenderness L/D"
              value={fmt(L / (od / 1000), 3)}
              tone={L / (od / 1000) < 10 ? "warn" : undefined}
              hint={L / (od / 1000) < 10 ? "short: shear matters" : "slender: formula is sound"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Try halving L: bending frequencies rise ×4 (∝ 1/L²) but the axial frequency only ×2 (∝
            1/L).
          </p>
        </>
      )}
    </LabShell>
  );
}
