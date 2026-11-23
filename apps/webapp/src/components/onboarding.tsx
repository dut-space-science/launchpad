import { useRef, useState } from "react";
import { FileUp, Library } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLaunchpadCourses, useOwnCourses } from "@/content/load";

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

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-3">
        <BrandMark className="size-10" />
        <h1 className="text-3xl font-semibold">Set up Launchpad</h1>
        <p className="max-w-xl text-muted-foreground">
          Launchpad has no courses yet. Choose where they come from. They are saved in this
          browser's database, and nothing is sent anywhere.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Library className="mb-1 size-6 text-primary" />
            <CardTitle>Launchpad courses</CardTitle>
            <CardDescription>
              The course library from the DUT Space Science Centre, with lessons, labs, quizzes and
              practice problems.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={busy !== null} onClick={() => run("default", useLaunchpadCourses)}>
              {busy === "default" ? "Installing…" : "Use Launchpad courses"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileUp className="mb-1 size-6 text-primary" />
            <CardTitle>My own courses</CardTitle>
            <CardDescription>
              Upload a SQLite database or a .sql file that follows the Launchpad course schema.{" "}
              <a href="content-schema.sql" download className="font-medium text-primary">
                Download the schema
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => input.current?.click()}
            >
              {busy === "own" ? "Checking…" : "Choose a file"}
            </Button>
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
          </CardContent>
        </Card>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
