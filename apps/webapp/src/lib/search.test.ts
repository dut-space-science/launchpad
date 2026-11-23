import { describe, expect, it } from "vite-plus/test";
import { createSearch, makeSnippet, parseQuery, plain, stem } from "./search";

type Doc = { id: string; title: string; summary?: string; body?: string };
const docs: Doc[] = [
  {
    id: "nozzle",
    title: "Nozzle design",
    summary: "Area ratio and separation",
    body: "The Summerfield criterion predicts separation.",
  },
  {
    id: "thrust",
    title: "Thrust and specific impulse",
    summary: "Thrust equation",
    body: "The nozzle expands gas.",
  },
  { id: "cool", title: "Cooling methods", summary: "Regenerative and film cooling of the nozzle" },
  { id: "modes", title: "Natural frequencies and mode shapes", summary: "Two modes" },
  { id: "model", title: "A finite element model", summary: "Meshing" },
  {
    id: "pumps",
    title: "Turbopumps",
    summary: "Pump power",
    body: "Cavitation destroys pumps. $\\zeta$ is the damping ratio.",
  },
  { id: "psd", title: "Random vibration", summary: "The PSD and Grms" },
];
const s = createSearch(docs, (d) => [
  { text: d.title, weight: 6 },
  { text: d.summary ?? "", weight: 3 },
  { text: d.body ?? "", weight: 1, snippet: true },
]);
const ids = (q: string) => s.search(q).results.map((r) => r.item.id);

describe("search", () => {
  it("normalises markup and stems plurals and -ing/-ed", () => {
    expect(plain("**$c^*$** and $\\zeta$")).not.toMatch(/[$*\\^]/);
    expect(plain("$\\zeta$")).toContain("zeta");
    expect(["nozzles", "cooling", "cooled", "frequencies", "modes"].map(stem)).toEqual([
      "nozzle",
      "cool",
      "cool",
      "frequency",
      "mode",
    ]);
    expect(stem("speed")).toBe("speed");
    expect(stem("analysis")).toBe("analysis");
  });

  it("drops filler words but keeps an all-filler query", () => {
    expect(parseQuery("how to cool a nozzle").terms).toEqual(["cool", "nozzle"]);
    expect(parseQuery("how to").terms).toEqual(["how", "to"]);
  });

  it("matches plurals and natural phrasing", () => {
    expect(ids("nozzles")).toContain("nozzle");
    expect(ids("how to cool a nozzle")).toEqual(["cool"]);
  });

  it("ranks a title hit above a body mention", () => {
    expect(ids("nozzle")[0]).toBe("nozzle");
    expect(ids("nozzle")).toContain("thrust");
  });

  it("searches body text and returns a snippet from it", () => {
    const r = s.search("summerfield").results;
    expect(r.map((x) => x.item.id)).toEqual(["nozzle"]);
    expect(r[0].snippet?.hit).toBe("Summerfield");
  });

  it("does not let a whole word match longer words", () => {
    expect(ids("mode")).toEqual(["modes"]);
  });

  it("completes half-typed words and forgives typos only when needed", () => {
    expect(ids("turbop")).toEqual(["pumps"]);
    expect(ids("cavitaton")).toEqual(["pumps"]);
  });

  it("expands abbreviations both ways", () => {
    expect(ids("isp")).toEqual(["thrust"]);
    expect(ids("power spectral density")).toEqual(["psd"]);
  });

  it("finds Greek letters written in LaTeX", () => {
    expect(ids("zeta")).toEqual(["pumps"]);
  });

  it("falls back to the best partial matches when nothing matches every word", () => {
    const out = s.search("nozzle unicorn");
    expect(out.partial).toBe(true);
    expect(out.results.length).toBeGreaterThan(0);
  });

  it("builds a snippet around the hit", () => {
    const sn = makeSnippet(
      "A long text where cavitation happens near the inlet.",
      new Set(["cavitation"]),
    );
    expect(sn?.hit).toBe("cavitation");
  });
});

describe("snippets", () => {
  it("show the word that is only in the body, not one already in the title", () => {
    const s2 = createSearch(
      [
        {
          title: "Cooling methods",
          body: "Film cooling protects the nozzle wall from the hot gas.",
        },
      ],
      (d) => [
        { text: d.title, weight: 6 },
        { text: d.body, weight: 1, snippet: true },
      ],
    );
    expect(s2.search("cool nozzle").results[0].snippet?.hit).toBe("nozzle");
  });
});
