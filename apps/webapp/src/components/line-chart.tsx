import { useId, useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/format";

export interface Series {
  name: string;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color?: string;
  dashed?: boolean;
  width?: number;
}
export interface VLine {
  x: number;
  label: string;
  color?: string;
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const W = 680;
const M = { l: 58, r: 16, t: 14, b: 44 };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 });
const tickLabel = (t: number) => (Math.abs(t) >= 1000 ? compact.format(t) : fmt(t, 3));

function niceTicks(lo: number, hi: number, n = 6) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Number(v.toPrecision(12)));
  return out;
}
function logTicks(lo: number, hi: number) {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) out.push(10 ** e);
  return out;
}

/**
 * Dependency-free responsive SVG line chart (log axes, vertical markers).
 * Dataviz rules: 2px lines, hairline recessive grid, snapping crosshair + one tooltip with every series,
 * keyboard stepping, legend when there are 2+ series, and a data table for reading values without hover.
 */
export function LineChart({
  series,
  xLog,
  yLog,
  xLabel,
  yLabel,
  vlines = [],
  xDomain,
  yDomain,
  height = 320,
  markers,
  caption,
}: {
  series: Series[];
  xLog?: boolean;
  yLog?: boolean;
  xLabel?: string;
  yLabel?: string;
  vlines?: VLine[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  height?: number;
  markers?: boolean;
  caption?: string;
}) {
  const H = height;
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  const dom = useMemo(() => {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const s of series) {
      for (let i = 0; i < s.x.length; i++) {
        const x = s.x[i],
          y = s.y[i];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (xLog && x <= 0) continue;
        if (yLog && y <= 0) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    if (!Number.isFinite(x0)) {
      x0 = 0;
      x1 = 1;
      y0 = 0;
      y1 = 1;
    }
    if (xDomain) [x0, x1] = xDomain;
    if (yDomain) [y0, y1] = yDomain;
    else if (yLog) {
      y0 = 10 ** Math.floor(Math.log10(y0));
      y1 = 10 ** Math.ceil(Math.log10(y1));
    } else {
      const pad = (y1 - y0) * 0.06 || 1;
      y0 -= pad;
      y1 += pad;
    }
    if (xLog && !xDomain) {
      x0 = 10 ** Math.floor(Math.log10(x0));
      x1 = 10 ** Math.ceil(Math.log10(x1));
    }
    if (x0 === x1) x1 = x0 + 1;
    if (y0 === y1) y1 = y0 + 1;
    return { x0, x1, y0, y1 };
  }, [series, xLog, yLog, xDomain, yDomain]);

  const sx = (x: number) =>
    M.l +
    (xLog
      ? Math.log10(x / dom.x0) / Math.log10(dom.x1 / dom.x0)
      : (x - dom.x0) / (dom.x1 - dom.x0)) *
      (W - M.l - M.r);
  const sy = (y: number) =>
    H -
    M.b -
    (yLog
      ? Math.log10(y / dom.y0) / Math.log10(dom.y1 / dom.y0)
      : (y - dom.y0) / (dom.y1 - dom.y0)) *
      (H - M.t - M.b);
  const xt = xLog ? logTicks(dom.x0, dom.x1) : niceTicks(dom.x0, dom.x1);
  const yt = yLog ? logTicks(dom.y0, dom.y1) : niceTicks(dom.y0, dom.y1);
  const colorOf = (s: Series, i: number) => s.color ?? COLORS[i % COLORS.length];

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    for (let i = 0; i < s.x.length; i++) {
      const x = s.x[i],
        y = s.y[i];
      const bad =
        !Number.isFinite(x) || !Number.isFinite(y) || (xLog && x <= 0) || (yLog && y <= 0);
      if (bad) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${Math.max(M.t - 40, Math.min(H + 40, sy(y))).toFixed(1)}`;
      pen = true;
    }
    return d;
  });

  const primary = series.find((s) => (s.width ?? 2) > 0) ?? series[0];
  const n = primary?.x.length ?? 0;

  function nearestIndex(xv: number) {
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < n; i++) {
      const v = primary.x[i];
      if (!Number.isFinite(v) || (xLog && v <= 0)) continue;
      const d = Math.abs(xLog ? Math.log(v / xv) : v - xv);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = Math.max(0, Math.min(1, (px - M.l) / (W - M.l - M.r)));
    setHi(nearestIndex(xLog ? dom.x0 * (dom.x1 / dom.x0) ** t : dom.x0 + t * (dom.x1 - dom.x0)));
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = Math.max(1, Math.round(n / 60)) * (e.key === "ArrowRight" ? 1 : -1);
      setHi((h) => Math.max(0, Math.min(n - 1, (h ?? Math.floor(n / 2)) + step)));
    } else if (e.key === "Escape") setHi(null);
  }
  const hx = hi !== null ? primary.x[hi] : null;
  const valueAt = (s: Series, x: number) => {
    let best = -1,
      bd = Infinity;
    for (let i = 0; i < s.x.length; i++) {
      const d = Math.abs(xLog ? Math.log(s.x[i] / x) : s.x[i] - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best < 0 ? NaN : s.y[best];
  };
  const tipLeft = hx !== null ? (sx(hx) / W) * 100 : 0;
  const flip = tipLeft > 62;
  const sampleIdx = Array.from({ length: Math.min(12, n) }, (_, i) =>
    Math.round((i * (n - 1)) / Math.max(1, Math.min(12, n) - 1)),
  );

  return (
    <figure className="w-full" ref={box}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-none select-none rounded-md outline-offset-4"
          onPointerMove={onMove}
          onPointerLeave={() => setHi(null)}
          onKeyDown={onKey}
          onBlur={() => setHi(null)}
          tabIndex={0}
          role="img"
          aria-label={`${yLabel ?? "Value"} versus ${xLabel ?? "x"}. Use left and right arrow keys to read values.`}
        >
          <defs>
            <clipPath id={id}>
              <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
            </clipPath>
          </defs>
          {xt.map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke="var(--border)" />
              <text
                x={sx(t)}
                y={H - M.b + 17}
                textAnchor="middle"
                className="fill-muted-foreground text-[12px]"
              >
                {tickLabel(t)}
              </text>
            </g>
          ))}
          {yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--border)" />
              <text
                x={M.l - 8}
                y={sy(t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[12px]"
              >
                {tickLabel(t)}
              </text>
            </g>
          ))}
          <line
            x1={M.l}
            x2={W - M.r}
            y1={H - M.b}
            y2={H - M.b}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.5}
          />
          {vlines.map(
            (v) =>
              v.x >= dom.x0 &&
              v.x <= dom.x1 && (
                <g key={v.label}>
                  <line
                    x1={sx(v.x)}
                    x2={sx(v.x)}
                    y1={M.t}
                    y2={H - M.b}
                    stroke={v.color ?? "var(--muted-foreground)"}
                    strokeDasharray="4 4"
                    strokeOpacity={0.9}
                  />
                  <text
                    x={sx(v.x) + 5}
                    y={M.t + 13}
                    className="fill-foreground text-[12px] font-medium"
                  >
                    {v.label}
                  </text>
                </g>
              ),
          )}
          <g clipPath={`url(#${id})`}>
            {series.map((s, i) => (
              <path
                key={s.name}
                d={paths[i]}
                fill="none"
                stroke={colorOf(s, i)}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {markers &&
              primary &&
              Array.from({ length: primary.x.length }, (_, i) => (
                <circle
                  key={i}
                  cx={sx(primary.x[i])}
                  cy={sy(primary.y[i])}
                  r={4}
                  fill={colorOf(primary, series.indexOf(primary))}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
          </g>
          {hx !== null && (
            <g>
              <line
                x1={sx(hx)}
                x2={sx(hx)}
                y1={M.t}
                y2={H - M.b}
                stroke="var(--foreground)"
                strokeOpacity={0.4}
              />
              {series
                .filter((s) => (s.width ?? 2) > 0)
                .map((s) => {
                  const y = valueAt(s, hx);
                  return Number.isFinite(y) && (!yLog || y > 0) ? (
                    <circle
                      key={s.name}
                      cx={sx(hx)}
                      cy={sy(y)}
                      r={4.5}
                      fill={colorOf(s, series.indexOf(s))}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ) : null;
                })}
            </g>
          )}
          {xLabel && (
            <text
              x={(M.l + W - M.r) / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[12px]"
            >
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-muted-foreground text-[12px]"
            >
              {yLabel}
            </text>
          )}
        </svg>
        {hx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md"
            style={flip ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}
            role="status"
          >
            <div className="mb-1 text-xs text-muted-foreground">
              {xLabel?.replace(/\s*\(.*\)/, "") ?? "x"} {fmt(hx, 4)}
            </div>
            {series
              .filter((s) => (s.width ?? 2) > 0)
              .map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-0.5 w-3.5 rounded"
                    style={{ background: colorOf(s, series.indexOf(s)) }}
                  />
                  <span className="font-semibold tabular-nums">{fmt(valueAt(s, hx), 4)}</span>
                  {series.length > 1 && (
                    <span className="text-xs text-muted-foreground">{s.name}</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-2">
              <svg width="18" height="8" aria-hidden>
                <line
                  x1="0"
                  x2="18"
                  y1="4"
                  y2="4"
                  stroke={colorOf(s, i)}
                  strokeWidth={Math.max(2, s.width ?? 2)}
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                  strokeLinecap="round"
                />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      {caption && <figcaption className="mt-1 text-sm text-muted-foreground">{caption}</figcaption>}
      <details className="mt-1 text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-primary">
          View data table
        </summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">{xLabel ?? "x"}</th>
                {series
                  .filter((s) => (s.width ?? 2) > 0)
                  .map((s) => (
                    <th key={s.name} className="px-3 py-1.5 font-medium">
                      {s.name}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {sampleIdx.map((i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1 tabular-nums">{fmt(primary.x[i], 4)}</td>
                  {series
                    .filter((s) => (s.width ?? 2) > 0)
                    .map((s) => (
                      <td key={s.name} className="px-3 py-1 tabular-nums">
                        {fmt(valueAt(s, primary.x[i]), 4)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
