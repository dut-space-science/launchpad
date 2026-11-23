import { useSyncExternalStore } from "react";
import { dayKey } from "@/lib/format";
import { initialState as initial, type State } from "@/store/state";
import type { Stream } from "@/lib/youtube";

export type { Card, QuizResult, State } from "@/store/state";

let state = initial();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

type Persister = (prev: State, next: State) => void;
let persister: Persister | null = null;

/** Called once at startup by the persistence layer: the database the state is written through to. */
export function setPersister(fn: Persister) {
  persister = fn;
}

/** Replace the in-memory state with what was loaded from storage (not written back). */
export function hydrate(next: State) {
  state = next;
  emit();
}

function commit(next: State) {
  const prev = state;
  state = next;
  persister?.(prev, next);
  emit();
}

function bump(s: State): State {
  const k = dayKey();
  return { ...s, activity: { ...s.activity, [k]: (s.activity[k] ?? 0) + 1 } };
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

export const getState = () => state;

export const actions = {
  setName: (name: string) => commit({ ...state, profile: { name } }),
  enroll: (course: string) =>
    state.enrolled[course]
      ? undefined
      : commit(bump({ ...state, enrolled: { ...state.enrolled, [course]: Date.now() } })),
  unenroll: (course: string) => {
    const { [course]: _drop, ...rest } = state.enrolled;
    void _drop;
    commit({ ...state, enrolled: rest });
  },
  visit: (course: string, lesson: string) => {
    if (state.last?.course === course && state.last.lesson === lesson) return;
    commit({
      ...state,
      last: { course, lesson },
      enrolled: state.enrolled[course]
        ? state.enrolled
        : { ...state.enrolled, [course]: Date.now() },
    });
  },
  toggleComplete: (course: string, lesson: string, value?: boolean) => {
    const k = `${course}/${lesson}`;
    const done = value ?? !state.completed[k];
    const completed = { ...state.completed };
    if (done) completed[k] = Date.now();
    else delete completed[k];
    commit(bump({ ...state, completed }));
  },
  recordQuiz: (course: string, module: string, score: number, passMark: number) => {
    const k = `${course}/${module}`;
    const prev = state.quizzes[k];
    const passed = score >= passMark;
    commit(
      bump({
        ...state,
        quizzes: {
          ...state.quizzes,
          [k]: {
            best: Math.max(prev?.best ?? 0, score),
            last: score,
            attempts: (prev?.attempts ?? 0) + 1,
            passed: passed || !!prev?.passed,
            at: Date.now(),
          },
        },
      }),
    );
  },
  setNote: (course: string, lesson: string, text: string) => {
    const notes = { ...state.notes };
    if (text.trim()) notes[`${course}/${lesson}`] = text;
    else delete notes[`${course}/${lesson}`];
    commit({ ...state, notes });
  },
  toggleBookmark: (course: string, lesson: string) => {
    const k = `${course}/${lesson}`;
    const bookmarks = { ...state.bookmarks };
    if (bookmarks[k]) delete bookmarks[k];
    else bookmarks[k] = Date.now();
    commit({ ...state, bookmarks });
  },
  setFocusMode: (on: boolean) => commit({ ...state, focusMode: on }),
  setVolume: (kind: "music" | "lessons", v: number) =>
    commit({
      ...state,
      volume: { ...state.volume, [kind]: Math.min(100, Math.max(0, Math.round(v))) },
    }),
  addStream: (s: Omit<Stream, "id">) => {
    const id = crypto.randomUUID();
    commit({ ...state, streams: [...state.streams, { ...s, id }] });
    return id;
  },
  renameStream: (id: string, label: string) =>
    commit({ ...state, streams: state.streams.map((x) => (x.id === id ? { ...x, label } : x)) }),
  removeStream: (id: string) =>
    commit({ ...state, streams: state.streams.filter((x) => x.id !== id) }),
  logFocus: (minutes: number) => {
    const k = dayKey();
    commit(bump({ ...state, focus: { ...state.focus, [k]: (state.focus[k] ?? 0) + minutes } }));
  },
  recordPractice: (course: string, pack: string, score: number) => {
    const k = `${course}/${pack}`;
    const prev = state.practice[k];
    commit(
      bump({
        ...state,
        practice: {
          ...state.practice,
          [k]: {
            best: Math.max(prev?.best ?? 0, score),
            last: score,
            attempts: (prev?.attempts ?? 0) + 1,
            at: Date.now(),
          },
        },
      }),
    );
  },
  togglePin: (course: string, id: string) => {
    const k = `${course}/${id}`;
    const pins = { ...state.pins };
    if (pins[k]) delete pins[k];
    else pins[k] = Date.now();
    commit({ ...state, pins });
  },
  gradeCard: (course: string, term: string, correct: boolean) => {
    const k = `${course}/${term}`;
    const box = correct ? Math.min((state.cards[k]?.box ?? 0) + 1, 4) : 0;
    const days = [0, 1, 3, 7, 21][box];
    const due = Date.now() + days * 86_400_000;
    commit(bump({ ...state, cards: { ...state.cards, [k]: { box, due } } }));
  },
  saveLab: (id: string, value: unknown) =>
    commit({ ...state, labState: { ...state.labState, [id]: value } }),
  replaceAll: (next: State) => commit({ ...initial(), ...next }),
  reset: () => commit(initial()),
};

export function streak(activity: Record<string, number>) {
  let n = 0;
  const d = new Date();
  if (!activity[dayKey(d)]) d.setDate(d.getDate() - 1); // today not yet counted is fine
  while (activity[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
