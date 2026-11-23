import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCourse } from "@/data/courses";
import { courseProgress } from "@/lib/progress";
import { actions, useStore } from "@/store/store";
import { NotFound } from "@/pages/not-found";

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function Certificate() {
  const { slug } = useParams();
  const course = getCourse(slug);
  const s = useStore((x) => x);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(s.profile.name);
  const p = course ? courseProgress(course, s) : undefined;
  const date = useMemo(
    () =>
      new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
    [],
  );

  useEffect(() => {
    const c = canvas.current;
    if (!c || !course || !p?.complete) return;
    const W = 1600,
      H = 1130;
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const navy = "#0b4626",
      gold = "#3fb06a";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);
    g.fillStyle = navy;
    g.fillRect(0, 0, W, 190);
    g.fillStyle = gold;
    g.fillRect(0, 190, W, 8);
    g.strokeStyle = navy;
    g.lineWidth = 6;
    g.strokeRect(40, 40, W - 80, H - 80);
    g.strokeStyle = gold;
    g.lineWidth = 2;
    g.strokeRect(58, 58, W - 116, H - 116);
    // mark
    g.save();
    g.translate(110, 60);
    g.scale(1.8, 1.8);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(32, 10);
    g.bezierCurveTo(39, 17, 41, 27, 38, 38);
    g.lineTo(26, 38);
    g.bezierCurveTo(23, 27, 25, 17, 32, 10);
    g.fill();
    g.strokeStyle = gold;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(32, 34, 24, 9, -0.42, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.textAlign = "left";
    g.fillStyle = "#fff";
    g.font = "700 46px system-ui, sans-serif";
    g.fillText("Launchpad", 250, 100);
    g.fillStyle = gold;
    g.font = "600 24px system-ui, sans-serif";
    g.fillText("DUT SPACE SCIENCE CENTRE", 252, 140);
    g.textAlign = "center";
    g.fillStyle = navy;
    g.font = "600 30px system-ui, sans-serif";
    g.fillText("CERTIFICATE OF COMPLETION", W / 2, 320);
    g.fillStyle = "#555";
    g.font = "28px system-ui, sans-serif";
    g.fillText("This certifies that", W / 2, 400);
    g.fillStyle = navy;
    g.font = "700 86px Georgia, serif";
    g.fillText(name || "Learner", W / 2, 520);
    g.fillStyle = gold;
    g.fillRect(W / 2 - 220, 550, 440, 4);
    g.fillStyle = "#555";
    g.font = "28px system-ui, sans-serif";
    g.fillText("has successfully completed all lessons, labs and quizzes of", W / 2, 625);
    g.fillStyle = navy;
    g.font = "700 50px system-ui, sans-serif";
    const words = course.title.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      if (g.measureText(line + w).width > 1200) {
        lines.push(line.trim());
        line = "";
      }
      line += w + " ";
    }
    lines.push(line.trim());
    lines.forEach((l, i) => g.fillText(l, W / 2, 705 + i * 62));
    const y = 705 + lines.length * 62 + 20;
    g.fillStyle = "#555";
    g.font = "26px system-ui, sans-serif";
    g.fillText(
      `${p.lessonsTotal} lessons · ${p.quizzesTotal} module quizzes passed · approx. ${Math.round(p.minutesDone / 60)} study hours`,
      W / 2,
      y,
    );
    g.textAlign = "left";
    g.font = "24px system-ui, sans-serif";
    g.fillStyle = navy;
    g.fillText(`Issued ${date}`, 140, H - 120);
    g.textAlign = "right";
    g.fillText(`Certificate ID ${hash(`${name}|${course.slug}|${date}`)}`, W - 140, H - 120);
    g.textAlign = "center";
    g.fillStyle = "#777";
    g.font = "20px system-ui, sans-serif";
    g.fillText(
      "Self-paced, self-assessed learning record. Generated on the learner's device.",
      W / 2,
      H - 75,
    );
  }, [course, p, name, date]);

  if (!course || !p) return <NotFound />;
  if (!p.complete) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Certificate locked</h1>
        <p className="mt-2 text-muted-foreground">
          Complete all {p.lessonsTotal} lessons ({p.done} done) and pass all {p.quizzesTotal} module
          quizzes ({p.quizzesPassed} passed) to unlock it.
        </p>
        <Link to={`/learn/${course.slug}`} className={buttonVariants({ className: "mt-6" })}>
          Continue learning
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="no-print space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Congratulations!</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cert-name">Name on certificate</Label>
            <Input
              id="cert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => actions.setName(name)}
              placeholder="Your full name"
              className="w-72"
            />
          </div>
          <Button
            onClick={() =>
              canvas.current?.toBlob((b) => {
                if (!b) return;
                const a = document.createElement("a");
                a.href = URL.createObjectURL(b);
                a.download = `launchpad-certificate-${course.slug}.png`;
                a.click();
              })
            }
          >
            <Download /> Download PNG
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print / save PDF
          </Button>
        </div>
      </div>
      <canvas
        ref={canvas}
        className="w-full rounded-lg border shadow-lg print:border-0 print:shadow-none"
        aria-label={`Certificate of completion for ${name || "learner"}`}
      />
    </div>
  );
}
