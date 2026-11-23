export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "eq"; text: string; name?: string; caption?: string }
  | { t: "callout"; kind: "key" | "tip" | "warn"; title?: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "lab"; id: string };

export interface Video {
  id: string; // YouTube video id
  title: string;
  channel: string;
  start?: number;
}

export interface Reference {
  title: string;
  org: string;
  url?: string; // omit for items that only live in the team study library
  note?: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  videos?: Video[];
  blocks: Block[];
  takeaways: string[];
  refs?: Reference[];
}

export interface Question {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export interface Module {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
  quiz: Question[];
}

export interface GlossaryTerm {
  term: string;
  unit?: string; // module id this term is drilled in (flashcards)
  def: string;
}

export interface Course {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  discipline: string; // primary discipline id, see data/taxonomy.ts
  alsoDisciplines?: string[];
  level: "Foundation" | "Intermediate" | "Advanced";
  instructor: { name: string; role: string };
  updated: string;
  outcomes: string[];
  prerequisites: string[];
  audience: string[];
  hue: number; // thumbnail accent hue
  modules: Module[];
  glossary: GlossaryTerm[];
  library: Reference[];
  databank?: DatabankExtras;
  practice?: Pack[];
}

/** A rule of thumb or key fact for the databank. `text` supports **bold**, *italic* and $LaTeX$. */
export interface Fact {
  id: string;
  unit: string;
  title: string;
  text: string;
}

export interface CodeSnippet {
  id: string;
  unit: string;
  title: string;
  lang: "python";
  code: string;
  note?: string;
}

export interface DatabankExtras {
  facts: Fact[];
  code: CodeSnippet[];
}

/** One practice problem. Text fields support **bold**, *italic* and $LaTeX$; blank lines split paragraphs. */
export interface Problem {
  id: string;
  kind: "mcq" | "numeric" | "written";
  prompt: string;
  difficulty: 1 | 2 | 3;
  hint?: string;
  solution: string;
  options?: string[]; // mcq
  answer?: number; // mcq: index of the correct option
  numeric?: { value: number; tolerance: number; unit: string }; // tolerance is relative (0.02 = 2%)
}

export interface Pack {
  id: string;
  unit: string; // module id, or "mixed"
  title: string;
  blurb: string;
  kind: "concept" | "problems" | "mixed";
  problems: Problem[];
}
