import type { ReactNode } from "react";
import { disciplineById } from "@/data/taxonomy";
import { cn } from "@/lib/utils";

/**
 * Course covers drawn as engineering figure plates: graph paper, a thin-line technical figure for the course's
 * discipline (a nozzle contour, beam mode shapes, a PSD envelope ...) and the knowledge-tree code as the plate number.
 * Colours come from the --plate-* tokens, so the plate is drafting paper in light mode and a dark chart recorder in dark.
 */

const W = 400;
const H = 200;

type Fig = (seed: number) => ReactNode;

const f = (n: number) => Math.round(n * 10) / 10;
const path = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("");
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sample = (from: number, to: number, n: number, fn: (x: number) => number) =>
  range(n + 1).map((i): [number, number] => {
    const x = from + ((to - from) * i) / n;
    return [x, fn(x)];
  });

/** Ink weights: the figure (strong), its construction lines (faint), and one accent mark. */
const Ink = (p: { d: string; w?: number; o?: number; accent?: boolean; dash?: string }) => (
  <path
    d={p.d}
    fill="none"
    stroke={p.accent ? "var(--plate-accent)" : "var(--plate-ink)"}
    strokeWidth={p.w ?? 1.75}
    strokeOpacity={p.o ?? 1}
    strokeDasharray={p.dash}
    strokeLinecap="round"
    strokeLinejoin="round"
    vectorEffect="non-scaling-stroke"
  />
);
const Dot = ({ x, y, r = 3.5, accent }: { x: number; y: number; r?: number; accent?: boolean }) => (
  <circle cx={x} cy={y} r={r} fill={accent ? "var(--plate-accent)" : "var(--plate-ink)"} />
);

// --- Engineering foundations -------------------------------------------------------------------------------------
const sampledSine: Fig = () => {
  const y = (x: number) => 104 - 46 * Math.sin((x - 150) / 22) * Math.exp(-(x - 150) / 420);
  const stems = range(17).map((i) => 160 + i * 13.5);
  return (
    <>
      <Ink d={path(sample(150, 390, 160, y))} o={0.45} />
      {stems.map((x) => (
        <g key={x}>
          <Ink d={`M${x} 104V${f(y(x))}`} w={1.25} o={0.8} />
          <Dot x={x} y={y(x)} r={3} accent />
        </g>
      ))}
      <Ink d="M150 104H392" w={1} o={0.5} />
    </>
  );
};

const isotherms: Fig = () => (
  <>
    {range(6).map((i) => (
      <Ink
        key={i}
        d={`M150 ${170 - i * 4} C 220 ${160 - i * 24}, 300 ${40 + i * 12}, 392 ${120 - i * 18}`}
        o={0.3 + i * 0.12}
        accent={i === 5}
      />
    ))}
    <Ink d="M150 176H392" w={2} />
    {range(9).map((i) => (
      <Ink key={i} d={`M${160 + i * 27} 176l-8 10`} w={1} o={0.6} />
    ))}
  </>
);

const feaMesh: Fig = () => {
  const cols = 9;
  const rows = 4;
  const p = (c: number, r: number): [number, number] => {
    const x = 170 + c * 25;
    const sag = 22 * Math.sin((Math.PI * c) / cols);
    return [x, 58 + r * 24 + sag];
  };
  const lines: string[] = [];
  for (let r = 0; r <= rows; r++) lines.push(path(range(cols + 1).map((c) => p(c, r))));
  for (let c = 0; c <= cols; c++) lines.push(path(range(rows + 1).map((r) => p(c, r))));
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) lines.push(path([p(c, r), p(c + 1, r + 1)]));
  return (
    <>
      <Ink d="M170 58V154M395 58V154" w={1} o={0.35} dash="3 4" />
      {lines.map((d, i) => (
        <Ink key={i} d={d} w={1.1} o={0.75} />
      ))}
      <Dot x={p(4, 2)[0] + 12} y={p(4, 2)[1]} accent />
    </>
  );
};

const modeShapes: Fig = () => (
  <>
    {[1, 2, 3].map((n, i) => {
      const y0 = 54 + i * 50;
      const L = 220;
      const pts = sample(0, L, 120, (x) => y0 - 18 * Math.sin((n * Math.PI * x) / L));
      const nodes = range(n + 1).map((k) => 168 + (k * L) / n);
      return (
        <g key={n}>
          <Ink d={`M168 ${y0}H${168 + L}`} w={1} o={0.35} dash="3 4" />
          <g
            className="mode-wave"
            style={{ transformOrigin: `0 ${y0}px`, animationDuration: `${3 / n}s` }}
          >
            <Ink d={path(pts.map(([x, y]) => [x + 168, y]))} accent={n === 1} />
          </g>
          {nodes.map((x) => (
            <Dot key={x} x={x} y={y0} r={3} />
          ))}
        </g>
      );
    })}
  </>
);

// --- Rocket propulsion --------------------------------------------------------------------------------------------
const bellNozzle: Fig = () => {
  const upper = (x: number) =>
    x < 210
      ? 72
      : x < 250
        ? 72 + 22 * (1 - Math.cos((Math.PI * (x - 210)) / 40)) * 0.5
        : 94 - 58 * Math.pow((x - 250) / 140, 0.55);
  const top = sample(160, 390, 120, upper);
  const bot = top.map(([x, y]): [number, number] => [x, 200 - y]);
  return (
    <>
      <Ink d={path(top)} w={2} />
      <Ink d={path(bot)} w={2} />
      <Ink d="M150 100H398" w={1} o={0.35} dash="8 4 2 4" />
      {range(3).map((i) => {
        const x = 300 + i * 34;
        return (
          <Ink
            key={i}
            d={`M${x} 100l17 -${16 - i * 3}l17 ${16 - i * 3}l-17 ${16 - i * 3}z`}
            accent
            w={1.25}
          />
        );
      })}
    </>
  );
};

const portRings: Fig = (seed) => (
  <>
    <circle cx="285" cy="100" r="82" fill="none" stroke="var(--plate-ink)" strokeWidth="2" />
    {range(4).map((i) => (
      <circle
        key={i}
        cx="285"
        cy="100"
        r={22 + i * 14}
        fill="none"
        stroke={i === 0 ? "var(--plate-accent)" : "var(--plate-ink)"}
        strokeOpacity={i === 0 ? 1 : 0.5 - i * 0.1}
        strokeWidth={i === 0 ? 2 : 1.25}
        strokeDasharray={i === 0 ? undefined : "4 4"}
      />
    ))}
    <Ink d={`M285 100l${58 + (seed % 3) * 4} -${50}`} w={1} o={0.6} />
  </>
);

const starGrain: Fig = () => {
  const pts = range(12).map((i): [number, number] => {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r = i % 2 ? 26 : 52;
    return [285 + r * Math.cos(a), 100 + r * Math.sin(a)];
  });
  return (
    <>
      <circle cx="285" cy="100" r="84" fill="none" stroke="var(--plate-ink)" strokeWidth="2" />
      <circle cx="285" cy="100" r="76" fill="none" stroke="var(--plate-ink)" strokeOpacity="0.35" />
      <Ink d={`${path(pts)}Z`} accent w={2} />
    </>
  );
};

const pressureCurves: Fig = () => {
  const curves = [
    (t: number) => 150 - 80 * Math.min(1, t * 8) * (1 - 0.35 * t),
    (t: number) => 150 - 80 * Math.min(1, t * 8) * (0.7 + 0.3 * t),
    (t: number) => 150 - 80 * Math.min(1, t * 8) * 0.85,
  ];
  return (
    <>
      <Ink d="M165 40V152H392" w={1.25} o={0.7} />
      {curves.map((c, i) => (
        <Ink
          key={i}
          d={path(sample(0, 1, 80, c).map(([t, y]) => [168 + t * 210, y]))}
          accent={i === 1}
          o={i === 1 ? 1 : 0.55}
        />
      ))}
    </>
  );
};

// --- Launch vehicles ----------------------------------------------------------------------------------------------
const apogee: Fig = () => {
  const traj = sample(0, 1, 80, (t) => 168 - 4 * 125 * t * (1 - t));
  const pts = traj.map(([t, y]): [number, number] => [165 + t * 225, y]);
  return (
    <>
      <Ink d="M150 168H398" w={1.25} o={0.6} />
      <Ink d={path(pts.slice(0, 18))} accent w={2.25} />
      <Ink d={path(pts.slice(17))} dash="5 5" />
      <Dot x={pts[40][0]} y={pts[40][1]} accent />
      <Ink d={`M${pts[40][0]} ${pts[40][1] + 8}V168`} w={1} o={0.35} dash="2 4" />
    </>
  );
};

const thrustBars: Fig = (seed) => (
  <>
    <Ink d="M160 160H394" w={1.25} o={0.6} />
    {range(14).map((i) => {
      const h = 30 + 70 * Math.abs(Math.sin(i * 0.55 + seed)) * (i < 2 ? 0.5 : 1);
      return (
        <rect
          key={i}
          x={168 + i * 16}
          y={160 - h}
          width="10"
          height={h}
          rx="2"
          fill={i === 6 ? "var(--plate-accent)" : "var(--plate-ink)"}
          fillOpacity={i === 6 ? 1 : 0.55}
        />
      );
    })}
  </>
);

const ascent: Fig = () => {
  const pts = sample(0, 1, 80, (t) => 180 - 150 * Math.sin((t * Math.PI) / 2) ** 0.8);
  const xy = pts.map(([t, y]): [number, number] => [170 + t * 220, y]);
  const stages = [26, 54];
  return (
    <>
      <path
        d="M120 330 A 330 330 0 0 1 430 150"
        fill="none"
        stroke="var(--plate-ink)"
        strokeOpacity="0.4"
        strokeWidth="1.25"
      />
      <Ink d={path(xy)} accent w={2.25} />
      {stages.map((i) => (
        <g key={i}>
          <Dot x={xy[i][0]} y={xy[i][1]} r={4.5} />
          <Ink d={`M${xy[i][0]} ${xy[i][1]}l-14 18`} w={1} o={0.6} />
        </g>
      ))}
    </>
  );
};

const vectors: Fig = () => {
  const pts = sample(0, 1, 6, (t) => 160 - 110 * Math.sin(t * Math.PI * 0.85));
  return (
    <>
      <Ink
        d={path(
          sample(0, 1, 60, (t) => 160 - 110 * Math.sin(t * Math.PI * 0.85)).map(([t, y]) => [
            170 + t * 215,
            y,
          ]),
        )}
        o={0.5}
      />
      {pts.map(([t, y], i) => {
        const x = 170 + t * 215;
        const slope = -110 * Math.PI * 0.85 * Math.cos(t * Math.PI * 0.85);
        const len = 34;
        const n = Math.hypot(215, slope);
        return (
          <g key={i}>
            <Ink
              d={`M${f(x)} ${f(y)}l${f((215 / n) * len)} ${f((slope / n) * len)}`}
              accent={i === 3}
              w={1.75}
            />
            <Ink d={`M${f(x)} ${f(y)}v22`} w={1} o={0.5} />
            <Dot x={x} y={y} r={2.75} />
          </g>
        );
      })}
    </>
  );
};

// --- Spacecraft and CubeSats -------------------------------------------------------------------------------------
const cube = (x: number, y: number, s: number, units: number) => {
  const dx = s * 0.6;
  const dy = s * 0.35;
  const h = s * units;
  return (
    <g>
      <Ink d={`M${x} ${y}l${dx} ${-dy}l${s} 0l${-dx} ${dy}z`} />
      <Ink d={`M${x} ${y}v${h}h${s}v${-h}M${x + s} ${y}l${dx} ${-dy}v${h}l${-dx} ${dy}`} />
      {range(units - 1).map((i) => (
        <Ink key={i} d={`M${x} ${y + s * (i + 1)}h${s}l${dx} ${-dy}`} w={1} o={0.5} />
      ))}
      <Ink
        d={`M${x + s * 0.2} ${y + s * 0.2}h${s * 0.6}v${s * 0.6}h${-s * 0.6}z`}
        accent
        w={1.25}
      />
    </g>
  );
};
const cubesats: Fig = () => (
  <>
    {cube(196, 72, 34, 3)}
    {cube(300, 108, 34, 1)}
  </>
);

const orbitTrack: Fig = () => (
  <>
    <ellipse
      cx="285"
      cy="100"
      rx="110"
      ry="40"
      transform="rotate(-14 285 100)"
      fill="none"
      stroke="var(--plate-ink)"
      strokeWidth="1.5"
    />
    <ellipse
      cx="285"
      cy="100"
      rx="68"
      ry="68"
      fill="none"
      stroke="var(--plate-ink)"
      strokeOpacity="0.35"
      strokeDasharray="3 4"
    />
    <circle cx="285" cy="100" r="30" fill="none" stroke="var(--plate-ink)" strokeWidth="1.5" />
    <Dot x={390} y={72} r={5} accent />
  </>
);

const psdEnvelope: Fig = () => (
  <>
    {range(6).map((i) => (
      <Ink key={i} d={`M${165 + i * 45} 40V160`} w={0.75} o={0.3} />
    ))}
    <Ink d="M165 160H392M165 40V160" w={1.25} o={0.6} />
    <Ink d="M165 140L220 80H330L392 128" accent w={2.25} />
    <Ink
      d={path(
        range(57).map((i) => [
          168 + i * 4,
          112 + 10 * Math.sin(i * 1.7) + 14 * Math.cos(i * 0.7) - (i > 12 && i < 40 ? 16 : 0),
        ]),
      )}
      w={1.1}
      o={0.65}
    />
  </>
);

const shakerProfile: Fig = () => (
  <>
    <Ink d="M160 150H394" w={1.25} o={0.6} />
    <Ink d="M170 150V120H220V95H270V70H330V150" w={2} />
    <Ink d="M170 128H222V103H272V78H332" accent w={1.25} dash="4 4" />
    <rect
      x="345"
      y="96"
      width="40"
      height="54"
      rx="3"
      fill="none"
      stroke="var(--plate-ink)"
      strokeWidth="1.5"
    />
    <Ink d="M352 96v-14h26v14" w={1.5} />
  </>
);

// --- Test, instrumentation and research practice -----------------------------------------------------------------
const coldFlow: Fig = () => {
  const p = (t: number) =>
    t < 0.15
      ? 150
      : t < 0.2
        ? 150 - (t - 0.15) * 1800
        : t < 0.75
          ? 60 + 6 * Math.sin(t * 90)
          : t < 0.85
            ? 60 + (t - 0.75) * 900
            : 150;
  return (
    <>
      <Ink d="M160 156H394" w={1.25} o={0.6} />
      <Ink d={path(sample(0, 1, 200, p).map(([t, y]) => [165 + t * 225, y]))} accent w={1.75} />
      <Ink d="M165 60H392" w={1} o={0.35} dash="3 4" />
    </>
  );
};

const accelTrace: Fig = (seed) => (
  <>
    <Ink d="M160 100H394" w={1} o={0.4} />
    <Ink
      d={path(
        range(115).map((i) => {
          const t = i / 114;
          const env = Math.exp(-((t - 0.3) ** 2) / 0.02) + 0.15;
          return [165 + t * 228, 100 + 70 * env * Math.sin(i * 1.9 + seed) * Math.cos(i * 0.37)];
        }),
      )}
      accent
      w={1.25}
    />
  </>
);

const signalChain: Fig = () => {
  const boxes = [170, 232, 294, 356];
  return (
    <>
      {boxes.map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y="80"
            width="38"
            height="40"
            rx="4"
            fill="none"
            stroke={i === 2 ? "var(--plate-accent)" : "var(--plate-ink)"}
            strokeWidth="1.75"
          />
          {i < 3 && <Ink d={`M${x + 38} 100h24m-6 -5l6 5l-6 5`} w={1.5} />}
        </g>
      ))}
      <Ink
        d={path(
          sample(0, 1, 24, (t) => 100 - 10 * Math.sin(t * 12)).map(([t, y]) => [174 + t * 30, y]),
        )}
        w={1.25}
      />
      <Ink d="M300 108l10 -16l10 16" w={1.25} o={0.7} />
    </>
  );
};

const testMatrix: Fig = (seed) => (
  <>
    {range(5).map((r) =>
      range(8).map((c) => {
        const on = (r * 7 + c * 3 + seed) % 4 !== 0;
        return (
          <circle
            key={`${r}-${c}`}
            cx={176 + c * 28}
            cy={48 + r * 26}
            r={on ? 5.5 : 4}
            fill={on ? (r === 2 && c === 4 ? "var(--plate-accent)" : "var(--plate-ink)") : "none"}
            fillOpacity={on ? 0.8 : 0}
            stroke="var(--plate-ink)"
            strokeOpacity="0.5"
          />
        );
      }),
    )}
  </>
);

const paperColumns: Fig = () => (
  <>
    <rect
      x="200"
      y="30"
      width="150"
      height="150"
      rx="3"
      fill="none"
      stroke="var(--plate-ink)"
      strokeWidth="1.5"
    />
    <Ink d="M214 48h122" w={3} />
    {range(9).map((i) => (
      <g key={i}>
        <Ink d={`M214 ${70 + i * 11}h${i === 8 ? 40 : 56}`} w={1.25} o={0.55} />
        <Ink d={`M280 ${70 + i * 11}h${i === 5 ? 30 : 56}`} w={1.25} o={0.55} />
      </g>
    ))}
    <rect
      x="280"
      y="70"
      width="56"
      height="34"
      rx="2"
      fill="none"
      stroke="var(--plate-accent)"
      strokeWidth="1.5"
    />
  </>
);

/** One figure per discipline in the knowledge tree; anything else (a custom course) gets a figure by its field. */
const BY_DISCIPLINE: Record<string, Fig> = {
  "signals-dsp": sampledSine,
  "thermo-fluids": isotherms,
  numerical: feaMesh,
  "structures-vibration": modeShapes,
  "liquid-engines": bellNozzle,
  "hybrid-engines": portRings,
  "solid-motors": starGrain,
  "green-propellants": pressureCurves,
  phoenix: apogee,
  saffire: thrustBars,
  clv: ascent,
  "flight-dynamics": vectors,
  "cubesat-standards": cubesats,
  "small-spacecraft": orbitTrack,
  "launch-environments": psdEnvelope,
  "verification-test": shakerProfile,
  "test-facilities": coldFlow,
  "vibration-measurement": accelTrace,
  daq: signalChain,
  "campaign-design": testMatrix,
  "research-comms": paperColumns,
};
const BY_FIELD: Record<string, Fig> = {
  foundations: modeShapes,
  propulsion: bellNozzle,
  vehicles: ascent,
  spacecraft: orbitTrack,
  test: accelTrace,
};

const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export function CourseArt({
  course,
  className,
  muted = false,
  animate = false,
  paper = true,
}: {
  course: { title: string; discipline: string; slug?: string };
  className?: string;
  /** Planned courses: the same plate, drawn fainter. */
  muted?: boolean;
  /** Let figures that can move (standing waves) move. Used once, on the setup screen. */
  animate?: boolean;
  /** Draw the graph paper. Off when the plate sits on a surface that already has it. */
  paper?: boolean;
}) {
  const d = disciplineById(course.discipline);
  const seed = hash(course.slug ?? course.discipline) % 7;
  const fig =
    BY_DISCIPLINE[course.discipline] ??
    (d && BY_FIELD[d.field.id]) ??
    [sampledSine, modeShapes, psdEnvelope, accelTrace][hash(course.title) % 4];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn(
        "w-full",
        paper && "bg-[var(--plate-bg)]",
        animate && "plate-animate",
        className,
      )}
      role="img"
      aria-label={`${course.title} cover`}
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <pattern id="plate-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke="var(--plate-grid)" strokeWidth="1" />
        </pattern>
        <pattern id="plate-grid-major" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="var(--plate-grid)" strokeWidth="1.5" />
        </pattern>
      </defs>
      {paper && (
        <>
          <rect width={W} height={H} fill="url(#plate-grid)" />
          <rect width={W} height={H} fill="url(#plate-grid-major)" />
        </>
      )}
      <g opacity={muted ? 0.55 : 1}>{fig(seed)}</g>
      {d && (
        <text
          x="22"
          y={H - 24}
          fill="var(--plate-ink)"
          fillOpacity={muted ? 0.5 : 0.9}
          style={{ font: "600 54px var(--font-heading)", letterSpacing: "-0.04em" }}
        >
          {d.code}
        </text>
      )}
    </svg>
  );
}
