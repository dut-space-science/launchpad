/**
 * How courses are organised, from the branches of .archive/KNOWLEDGE_TREE.md.
 * Field = a top-level branch (0 to 4). Discipline = a sub-branch (0.1, 0.2, ...).
 * The data lives in the content database (db/seed/00-taxonomy.sql); `setFields` fills this registry at start-up.
 */
export interface Discipline {
  id: string;
  code: string; // position in the knowledge tree
  name: string;
  topics: string[];
  level: "Foundation" | "Intermediate" | "Advanced";
}
export interface Field {
  id: string;
  code: string;
  name: string;
  summary: string;
  disciplines: Discipline[];
}

export type DisciplineEntry = Discipline & { field: Field };

export let fields: Field[] = [];
export let allDisciplines: DisciplineEntry[] = [];

export function setFields(next: Field[]) {
  fields = next;
  allDisciplines = next.flatMap((f) => f.disciplines.map((d) => ({ ...d, field: f })));
}
export const disciplineById = (id: string) => allDisciplines.find((d) => d.id === id);
export const fieldById = (id: string) => fields.find((f) => f.id === id);
export const fieldOfDiscipline = (id: string) => disciplineById(id)?.field;
