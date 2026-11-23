import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { CodeBlock } from "@/components/code-block";

/** Elements get the platform's own lesson styling (see .prose-md in index.css); tables and code are custom. */
const components: Components = {
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t px-3 py-2 align-top">{children}</td>,
  // Fenced blocks become highlighted code; inline `code` keeps the lesson style.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = (Array.isArray(children) ? children : [children])
      .filter((c): c is string => typeof c === "string")
      .join("");
    const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
    return lang || text.includes("\n") ? (
      <CodeBlock code={text} language={lang ?? "text"} />
    ) : (
      <code>{children}</code>
    );
  },
  a: ({ href, children }) => {
    const external = !!href && /^https?:/.test(href);
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  },
};

/**
 * Markdown rendered as part of the page: same typography as the lessons, flowing in the page scroll
 * (no inner scroll box). Supports GitHub-flavoured Markdown, tables, task lists and $LaTeX$.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
