import { Fragment, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Link } from "react-router-dom";
import { AlertTriangle, FlaskConical, KeyRound, Lightbulb } from "lucide-react";
import type { Block } from "@/data/types";
import { LAB_REGISTRY } from "@/labs";
import { cn } from "@/lib/utils";

/** KaTeX renderer. Content is authored in this repo, so rendering its HTML is trusted. */
export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
  });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Tiny inline markup: **bold**, *italic* and $LaTeX$. Maths is matched first and may sit inside bold or italic, so a
 * `*` inside a formula ($c^*$) is never mistaken for emphasis.
 */
const MATH = String.raw`\$[^$]+\$`;
const INLINE = new RegExp(`(${MATH}|\\*\\*(?:${MATH}|[^*$])+\\*\\*|\\*(?:${MATH}|[^*$])+\\*)`, "g");

export function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$") && p.length > 2 ? (
          <Tex key={i} tex={p.slice(1, -1)} />
        ) : p.startsWith("**") && p.length > 4 ? (
          <strong key={i}>
            <Inline text={p.slice(2, -2)} />
          </strong>
        ) : p.startsWith("*") && p.length > 2 ? (
          <em key={i}>
            <Inline text={p.slice(1, -1)} />
          </em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const CALLOUT = {
  key: { icon: KeyRound, cls: "border-primary/40 bg-primary/5", label: "Key idea" },
  tip: { icon: Lightbulb, cls: "border-gold/60 bg-gold/10", label: "Tip" },
  warn: { icon: AlertTriangle, cls: "border-destructive/50 bg-destructive/5", label: "Watch out" },
} as const;

export function Blocks({ blocks, labHref }: { blocks: Block[]; labHref?: (id: string) => string }) {
  const out: ReactNode[] = blocks.map((b, i) => {
    switch (b.t) {
      case "h":
        return <h3 key={i}>{b.text}</h3>;
      case "p":
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      case "ul":
        return (
          <ul key={i}>
            {b.items.map((t, j) => (
              <li key={j}>
                <Inline text={t} />
              </li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={i}>
            {b.items.map((t, j) => (
              <li key={j}>
                <Inline text={t} />
              </li>
            ))}
          </ol>
        );
      case "eq":
        return (
          <figure key={i} className="plate-paper my-6 rounded-lg border px-4 py-4">
            <div className="overflow-x-auto py-1 text-center text-[1.05rem]" role="math">
              <Tex tex={b.text} display />
            </div>
            {b.caption && (
              <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                {b.caption}
              </figcaption>
            )}
          </figure>
        );
      case "callout": {
        const c = CALLOUT[b.kind];
        const Icon = c.icon;
        return (
          <aside key={i} className={cn("my-6 flex gap-3 rounded-lg border p-4 leading-7", c.cls)}>
            <Icon className="mt-1.5 size-4 shrink-0" />
            <div>
              <div className="mb-0.5 font-semibold">{b.title ?? c.label}</div>
              <Inline text={b.text} />
            </div>
          </aside>
        );
      }
      case "table":
        return (
          <div key={i} className="my-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  {b.head.map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-t">
                    {r.map((c, k) => (
                      <td key={k} className="px-3 py-2 align-top">
                        <Inline text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "lab": {
        const lab = LAB_REGISTRY[b.id];
        if (!lab) return null;
        if (labHref) {
          return (
            <Link
              key={i}
              to={labHref(b.id)}
              className="my-6 flex items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <FlaskConical className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">Lab: {lab.title}</span>
                <span className="block text-muted-foreground">{lab.blurb}</span>
              </span>
              <span className="self-center text-sm font-medium text-primary">Open lab</span>
            </Link>
          );
        }
        const Lab = lab.component;
        return <Lab key={i} />;
      }
    }
  });
  return <div className="prose-lesson">{out}</div>;
}
