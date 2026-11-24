export function fmt(n: number, digits = 3) {
  if (!Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return n.toExponential(digits - 1);
  return Number(n.toPrecision(digits)).toString();
}

export function minutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The app's locale for dates and times: South African English (day first, 24-hour clock). */
export const LOCALE = "en-ZA";

/** Format a date for display in the app's locale. Without options: "21 Nov 2026". */
export function fmtDate(d: Date | number, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    LOCALE,
    options ?? { day: "numeric", month: "short", year: "numeric" },
  ).format(d);
}

/** Days since Monday for a date: 0 for Monday up to 6 for Sunday. Weeks start on Monday here. */
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
