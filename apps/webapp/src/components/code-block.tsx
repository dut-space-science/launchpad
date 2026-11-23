import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Copy was blocked by the browser");
  }
}

/** Syntax-highlighted code with a copy button. Shared by the databank and rendered Markdown notes. */
export function CodeBlock({ code, language = "python" }: { code: string; language?: string }) {
  const { resolvedTheme } = useTheme();
  const [done, setDone] = useState(false);
  return (
    <div className="relative my-4">
      <Highlight
        code={code.trimEnd()}
        language={language}
        theme={resolvedTheme === "dark" ? themes.vsDark : themes.github}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="overflow-x-auto rounded-lg border p-3 text-[0.82rem] leading-relaxed"
            style={{ ...style, background: "var(--muted)" }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, k) => (
                  <span key={k} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      <Button
        variant="outline"
        size="xs"
        className="no-print absolute top-2 right-2"
        onClick={async () => {
          await copyText(code, "Code");
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check /> : <Copy />} {done ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
