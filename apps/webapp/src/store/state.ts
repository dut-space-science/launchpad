import type { Stream } from "@/lib/youtube";

export interface QuizResult {
  best: number; // 0..1
  last: number;
  attempts: number;
  passed: boolean;
  at: number;
}
export interface Card {
  box: number; // Leitner box 0..4
  due: number; // epoch ms
}
export interface State {
  v: 1;
  profile: { name: string };
  enrolled: Record<string, number>; // course -> ts
  completed: Record<string, number>; // `${course}/${lesson}` -> ts
  quizzes: Record<string, QuizResult>; // `${course}/${module}`
  notes: Record<string, string>; // `${course}/${lesson}`
  bookmarks: Record<string, number>;
  pins: Record<string, number>; // databank items, course/itemId
  focusMode: boolean; // wide lesson video with the navigation and sidebar hidden
  volume: { music: number; lessons: number }; // 0 to 100, applied to the matching YouTube embeds
  streams: Stream[]; // the learner's own study music list (YouTube)
  focus: Record<string, number>; // minutes of completed focus sessions per day
  practice: Record<string, { best: number; last: number; attempts: number; at: number }>; // `${course}/${packId}`
  last: { course: string; lesson: string } | null;
  cards: Record<string, Card>; // `${course}/${term}`
  activity: Record<string, number>; // yyyy-mm-dd -> actions
  labState: Record<string, unknown>; // saved lab snapshots
}

export const initialState = (): State => ({
  v: 1,
  profile: { name: "" },
  enrolled: {},
  completed: {},
  quizzes: {},
  notes: {},
  bookmarks: {},
  pins: {},
  focusMode: false,
  volume: { music: 50, lessons: 100 },
  streams: [],
  focus: {},
  practice: {},
  last: null,
  cards: {},
  activity: {},
  labState: {},
});
