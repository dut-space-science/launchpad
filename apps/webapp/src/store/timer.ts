import { useSyncExternalStore } from "react";
import { actions } from "@/store/store";

/** Pomodoro timer. Lives outside React so it keeps running across page changes and survives a reload. */
export type Mode = "focus" | "short" | "long";

export interface TimerState {
  mode: Mode;
  running: boolean;
  endAt: number | null; // epoch ms while running
  remainingMs: number; // while paused
  round: number; // focus sessions finished in the current cycle (0..3)
  cfg: Record<Mode, number>; // minutes
  alerts: boolean; // browser notifications when a period ends
}

const KEY = "launchpad:timer";
const DEFAULT_CFG: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
export const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};
export const CYCLE = 4;

const ms = (m: number) => Math.round(m * 60_000);

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as TimerState;
      return { ...fresh(), ...s, cfg: { ...DEFAULT_CFG, ...s.cfg } };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return fresh();
}
function fresh(): TimerState {
  return {
    mode: "focus",
    running: false,
    endAt: null,
    remainingMs: ms(DEFAULT_CFG.focus),
    round: 0,
    cfg: { ...DEFAULT_CFG },
    alerts: false,
  };
}

let state: TimerState = typeof window === "undefined" ? fresh() : load();
const listeners = new Set<() => void>();

function commit(next: TimerState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useTimer() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const remaining = (s: TimerState, now = Date.now()) =>
  s.running && s.endAt ? Math.max(0, s.endAt - now) : s.remainingMs;

export const timer = {
  start() {
    if (state.running) return;
    commit({ ...state, running: true, endAt: Date.now() + state.remainingMs });
  },
  pause() {
    if (!state.running) return;
    commit({ ...state, running: false, remainingMs: remaining(state), endAt: null });
  },
  reset() {
    commit({ ...state, running: false, endAt: null, remainingMs: ms(state.cfg[state.mode]) });
  },
  /** Turning alerts on asks the browser for notification permission. Returns whether alerts are now on. */
  async setAlerts(on: boolean) {
    let ok = on;
    if (on) {
      if (typeof Notification === "undefined") ok = false;
      else if (Notification.permission === "granted") ok = true;
      else ok = (await Notification.requestPermission()) === "granted";
    }
    commit({ ...state, alerts: ok });
    return ok;
  },
  setMode(mode: Mode) {
    commit({ ...state, mode, running: false, endAt: null, remainingMs: ms(state.cfg[mode]) });
  },
  setMinutes(mode: Mode, minutes: number) {
    const m = Math.min(180, Math.max(1, Math.round(minutes) || 1));
    const cfg = { ...state.cfg, [mode]: m };
    commit({
      ...state,
      cfg,
      ...(state.mode === mode && !state.running ? { remainingMs: ms(m) } : {}),
    });
  },
  /** Finish the current period and move to the next one (paused, waiting for you to press start). */
  complete(counted = true) {
    let { round } = state;
    let next: Mode = "focus";
    if (state.mode === "focus") {
      if (counted) actions.logFocus(state.cfg.focus);
      round += 1;
      if (round >= CYCLE) {
        next = "long";
        round = 0;
      } else next = "short";
    }
    commit({
      ...state,
      mode: next,
      round,
      running: false,
      endAt: null,
      remainingMs: ms(state.cfg[next]),
    });
    return next;
  },
};

export function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t);
      o.stop(t + 0.22);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio blocked: the on-screen notice still appears */
  }
}
