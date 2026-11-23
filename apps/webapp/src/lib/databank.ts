import type { Course } from "@/data/types";
import { unitLabs } from "@/data/courses";
import { LAB_REGISTRY } from "@/labs";

export type Kind = "formula" | "fact" | "code" | "tool" | "term";

export const KINDS: { key: Kind; label: string; plural: string }[] = [
  { key: "formula", label: "Formula", plural: "Formulas" },
  { key: "fact", label: "Rule of thumb", plural: "Rules of thumb" },
  { key: "code", label: "Code", plural: "Code" },
  { key: "tool", label: "Tool", plural: "Tools" },
  { key: "term", label: "Term", plural: "Terms" },
];

interface Base {
  id: string;
  unit: string;
  title: string;
  search: string;
}
export type Item = Base &
  (
    | { kind: "formula"; tex: string; caption?: string; lessonId: string; lessonTitle: string }
    | { kind: "fact"; text: string }
    | { kind: "code"; code: string; note?: string }
    | { kind: "tool"; labId: string; blurb: string }
    | { kind: "term"; def: string }
  );

/** Everything a learner might carry into the field, derived from course content. */
export function buildItems(course: Course): Item[] {
  const out: Item[] = [];
  for (const m of course.modules) {
    for (const l of m.lessons) {
      l.blocks.forEach((b, i) => {
        if (b.t !== "eq") return;
        const title = b.name ?? b.caption ?? l.title;
        out.push({
          id: `f:${l.id}:${i}`,
          kind: "formula",
          unit: m.id,
          title,
          tex: b.text,
          caption: b.caption,
          lessonId: l.id,
          lessonTitle: l.title,
          search: `${title} ${l.title} ${b.text}`,
        });
      });
    }
    for (const id of unitLabs(m)) {
      const lab = LAB_REGISTRY[id];
      if (lab) {
        out.push({
          id: `t:${m.id}:${id}`,
          kind: "tool",
          unit: m.id,
          title: lab.title,
          labId: id,
          blurb: lab.blurb,
          search: `${lab.title} ${lab.blurb} lab calculator`,
        });
      }
    }
  }
  for (const f of course.databank?.facts ?? []) {
    out.push({
      id: `r:${f.id}`,
      kind: "fact",
      unit: f.unit,
      title: f.title,
      text: f.text,
      search: `${f.title} ${f.text}`,
    });
  }
  for (const c of course.databank?.code ?? []) {
    out.push({
      id: `c:${c.id}`,
      kind: "code",
      unit: c.unit,
      title: c.title,
      code: c.code,
      note: c.note,
      search: `${c.title} ${c.note ?? ""} ${c.code} python`,
    });
  }
  for (const g of course.glossary) {
    if (g.unit)
      out.push({
        id: `g:${g.term}`,
        kind: "term",
        unit: g.unit,
        title: g.term,
        def: g.def,
        search: `${g.term} ${g.def}`,
      });
  }
  return out;
}

const FENCE = "```";

/** Markdown export of a databank selection, so it can be kept in a notes app or a repo. */
export function toMarkdown(course: Course, items: Item[], heading = "My databank") {
  const lines = [`# ${heading}`, "", course.title, ""];
  for (const m of course.modules) {
    const inUnit = items.filter((i) => i.unit === m.id);
    if (!inUnit.length) continue;
    lines.push(`## ${m.title}`, "");
    for (const k of KINDS) {
      const group = inUnit.filter((i) => i.kind === k.key);
      if (!group.length) continue;
      lines.push(`### ${k.plural}`, "");
      for (const it of group) {
        if (it.kind === "formula") lines.push(`**${it.title}**`, "", "$$" + it.tex + "$$", "");
        else if (it.kind === "fact") lines.push(`- **${it.title}.** ${it.text}`);
        else if (it.kind === "code")
          lines.push(`**${it.title}**`, "", FENCE + "python", it.code, FENCE, "");
        else if (it.kind === "tool") lines.push(`- **${it.title}**: ${it.blurb}`);
        else lines.push(`- **${it.title}**: ${it.def}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
