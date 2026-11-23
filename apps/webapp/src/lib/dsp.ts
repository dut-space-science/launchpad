/** Small DSP toolkit for the labs. Everything runs in the browser. */

export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Welch one-sided PSD (units^2/Hz), Hann window, 50% overlap, mean removed. */
export function welch(x: ArrayLike<number>, fs: number, nperseg = 1024) {
  let n = 1;
  while (n * 2 <= Math.min(nperseg, x.length)) n *= 2;
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i];
  const mean = sum / x.length;
  const w = new Float64Array(n).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  const u = w.reduce((a, b) => a + b * b, 0);
  const hop = n / 2;
  const half = n / 2 + 1;
  const psd = new Float64Array(half);
  let segs = 0;
  for (let s = 0; s + n <= x.length; s += hop) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = (x[s + i] - mean) * w[i];
    fft(re, im);
    for (let k = 0; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  const f = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    f[k] = (k * fs) / n;
    psd[k] = (psd[k] / (segs * fs * u)) * (k === 0 || k === half - 1 ? 1 : 2);
  }
  return { f, psd, df: fs / n, segs, n };
}

export function rms(x: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

export function linspace(a: number, b: number, n: number) {
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}
export function logspace(a: number, b: number, n: number) {
  const la = Math.log10(a);
  const lb = Math.log10(b);
  return Array.from({ length: n }, (_, i) => 10 ** (la + ((lb - la) * i) / (n - 1)));
}

/** Frequency that a tone at f appears at after sampling at fs. */
export function aliasOf(f: number, fs: number) {
  const k = Math.round(f / fs);
  return Math.abs(f - k * fs);
}

/** Integrate a piecewise log-log PSD (breakpoints [Hz, g^2/Hz]) to mean-square (g^2). */
export function psdArea(pts: [number, number][]) {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [f1, w1] = pts[i];
    const [f2, w2] = pts[i + 1];
    if (f2 <= f1 || w1 <= 0 || w2 <= 0) continue;
    const m = Math.log(w2 / w1) / Math.log(f2 / f1);
    a +=
      Math.abs(m + 1) < 1e-9
        ? w1 * f1 * Math.log(f2 / f1)
        : ((w1 * f1) / (m + 1)) * ((f2 / f1) ** (m + 1) - 1);
  }
  return a;
}

export function psdAt(pts: [number, number][], f: number) {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [f1, w1] = pts[i];
    const [f2, w2] = pts[i + 1];
    if (f <= f2) return w1 * (f / f1) ** (Math.log(w2 / w1) / Math.log(f2 / f1));
  }
  return pts[pts.length - 1][1];
}

/** Shock response spectrum (absolute acceleration, maximax) via exact-ish Newmark. */
export function srs(accel: Float64Array, dt: number, freqs: number[], q = 10) {
  const zeta = 1 / (2 * q);
  return freqs.map((fn) => {
    const w = 2 * Math.PI * fn;
    let z = 0;
    let v = 0;
    let a = -accel[0] - 2 * zeta * w * v - w * w * z;
    let peak = 0;
    const beta = 0.25;
    const gamma = 0.5;
    const c = 2 * zeta * w;
    const k = w * w;
    const keff = k + (gamma * c) / (beta * dt) + 1 / (beta * dt * dt);
    for (let i = 1; i < accel.length; i++) {
      const p = -accel[i];
      const rhs =
        p +
        (1 / (beta * dt * dt) + (gamma * c) / (beta * dt)) * z +
        (1 / (beta * dt) + c * (gamma / beta - 1)) * v +
        (1 / (2 * beta) - 1 + c * dt * (gamma / (2 * beta) - 1)) * a;
      const zn = rhs / keff;
      const vn =
        (gamma / (beta * dt)) * (zn - z) +
        (1 - gamma / beta) * v +
        dt * (1 - gamma / (2 * beta)) * a;
      const an = (zn - z) / (beta * dt * dt) - v / (beta * dt) - (1 / (2 * beta) - 1) * a;
      z = zn;
      v = vn;
      a = an;
      const abs = Math.abs(c * v + k * z);
      if (abs > peak) peak = abs;
    }
    return peak;
  });
}
