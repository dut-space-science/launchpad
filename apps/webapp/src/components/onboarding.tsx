import { useRef, useState } from "react";
import { ArrowRight, FileUp, Library, LoaderCircle } from "lucide-react";
import { Brand } from "@/components/brand";
import { CourseArt } from "@/components/course-art";
import { useLaunchpadCourses, useOwnCourses } from "@/content/load";
import { cn } from "@/lib/utils";

/** First-run setup, shown whenever the app has no courses (fresh install or after Wipe all data). */
export function Onboarding() {
  const [busy, setBusy] = useState<"default" | "own" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function run(kind: "default" | "own", task: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await task(); // success restarts the page
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  const option =
    "group flex w-full items-center gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/60 disabled:pointer-events-none disabled:opacity-60";

  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="mx-auto flex w-full max-w-xl flex-col justify-center gap-10 px-6 py-12 sm:px-12 lg:max-w-none lg:pr-16 lg:pl-[max(4rem,calc(50vw-36rem))]">
        <Brand tagline />
        <header className="space-y-4">
          <h1 className="max-w-md text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">
            Set up Launchpad
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Choose where the courses come from. They are saved in this browser, and nothing is sent
            anywhere.
          </p>
        </header>

        <div className="max-w-md space-y-3">
          <button
            type="button"
            className={cn(option, "border-primary/40")}
            disabled={busy !== null}
            onClick={() => run("default", useLaunchpadCourses)}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              {busy === "default" ? <LoaderCircle className="animate-spin" /> : <Library />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold">
                {busy === "default" ? "Installing…" : "Use Launchpad courses"}
              </span>
              <span className="block text-muted-foreground">
                Lessons, labs, quizzes and practice from the DUT Space Science Centre
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>

          <button
            type="button"
            className={option}
            disabled={busy !== null}
            onClick={() => input.current?.click()}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
              {busy === "own" ? <LoaderCircle className="animate-spin" /> : <FileUp />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold">
                {busy === "own" ? "Checking…" : "Upload my own courses"}
              </span>
              <span className="block text-muted-foreground">
                A SQLite database or .sql file in the Launchpad schema
              </span>
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept=".sqlite,.sqlite3,.db,.sql"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void run("own", () => useOwnCourses(f));
            }}
          />
          <a
            href="content-schema.sql"
            download
            className="inline-block pt-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            Download the course schema
          </a>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="plate-paper hidden items-center border-l px-12 lg:flex" aria-hidden>
        <CourseArt
          course={{ title: "Beam mode shapes", discipline: "structures-vibration" }}
          animate
          paper={false}
          className="-ml-[30%] w-[130%] max-w-none"
        />
      </div>
    </main>
  );
}
