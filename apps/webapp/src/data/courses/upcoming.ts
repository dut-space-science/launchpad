import type { Course } from "../types";
import { allDisciplines } from "../taxonomy";

/**
 * Planned courses, shown in the catalog as "Coming soon". One per discipline in the knowledge tree
 * (the catalog hides any discipline that already has a real course). Titles are the tree's own names.
 */
export interface UpcomingCourse {
  slug: string;
  title: string;
  subtitle: string;
  discipline: string;
  level: Course["level"];
  hue: number;
}

export const upcomingCourses = (): UpcomingCourse[] =>
  allDisciplines.map((d) => ({
    slug: d.id,
    title: d.name,
    subtitle: `${d.topics.slice(0, 3).join(", ")}.`,
    discipline: d.id,
    level: d.level,
    hue: 150,
  }));
