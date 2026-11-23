/**
 * Full-text search used everywhere in the app (Explore courses and topics, databank, practice packs, notebook).
 *
 * Each item is described by weighted text fields. Text is normalised (case, accents, Markdown and LaTeX markup),
 * split into words and lightly stemmed, so "nozzles" finds "nozzle" and "cooling" finds "cooled". A query word
 * matches exactly first; only if the word appears nowhere in the collection does it fall back to a prefix (for
 * half-typed words) and then to a one- or two-letter typo. Filler words ("how", "to", "a") are ignored. Results are
 * ranked by field weight, so a title hit beats a passing mention in the body, and every query word must match.
 * If nothing matches every word, the items matching the most words are returned and flagged as partial.
 */

export interface SearchField {
  text: string;
  /** How much a hit here counts: title about 6, summary 3, body 1. */
  weight: number;
  /** Show a snippet from this field when the hit is not visible elsewhere (long body text). */
  snippet?: boolean;
}

export interface Snippet {
  before: string;
  hit: string;
  after: string;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  /** Set when the best evidence is in a snippet field, so the UI can show where the words were found. */
  snippet?: Snippet;
}

export interface SearchOutcome<T> {
  results: SearchResult<T>[];
  /** No item matched every query word; these match as many as possible. */
  partial: boolean;
  /** The query had no searchable words (empty, or only filler words). */
  empty: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Text normalisation

const GREEK = new Set(
  "alpha beta gamma delta epsilon varepsilon zeta eta theta lambda mu nu xi pi rho sigma tau phi varphi chi psi omega".split(
    " ",
  ),
);

/** Strip Markdown and LaTeX to plain words. Greek letter commands become their names (\zeta to zeta). */
export function plain(text: string): string {
  return text
    .replace(/\\([a-zA-Z]+)/g, (_, cmd: string) =>
      GREEK.has(cmd.toLowerCase()) ? ` ${cmd} ` : " ",
    )
    .replace(/[$*_^{}#`]/g, " ");
}

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const WORD = /[\p{L}\p{N}]+/gu;

/** Light English stemming: plurals and -ing/-ed, keeping at least four letters of stem. */
export function stem(w: string): string {
  if (w.length <= 3 || /^\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (/(?:xes|ches|shes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length - 3 >= 4) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length - 2 >= 4) return w.slice(0, -2);
  return w;
}

const words = (text: string) => (fold(plain(text)).match(WORD) ?? []).map(stem);

const STOP = new Set(
  (
    "a an and are as at be by can do does for from has have how i if in into is it its me my of on or our " +
    "so than that the their them then there these this to was we what when where which who why will with you your"
  ).split(" "),
);

/**
 * Abbreviations learners type and the phrases lesson text uses for them. An item containing either form is indexed
 * under both, so "isp" finds "specific impulse" and "power spectral density" finds "PSD".
 */
const ALIASES: [string, string][] = [
  ["isp", "specific impulse"],
  ["psd", "power spectral density"],
  ["srs", "shock response spectrum"],
  ["fft", "fast fourier transform"],
  ["dft", "discrete fourier transform"],
  ["frf", "frequency response function"],
  ["sdof", "single degree of freedom"],
  ["mdof", "multi degree of freedom"],
  ["lox", "liquid oxygen"],
  ["lh2", "liquid hydrogen"],
  ["npsh", "net positive suction head"],
  ["adc", "analog to digital"],
  ["daq", "data acquisition"],
  ["fea", "finite element"],
  ["cfd", "computational fluid dynamics"],
  ["iepe", "integrated electronics piezoelectric"],
  ["grms", "root mean square acceleration"],
];
const ALIAS_PHRASES = ALIASES.map(([abbr, phrase]) => ({
  abbr,
  phrase: words(phrase),
}));

/** Tokens for one field, including alias tokens for any abbreviation or phrase it contains. */
function fieldTokens(text: string): string[] {
  const t = words(text);
  const extra: string[] = [];
  const has = (seq: string[]) => {
    outer: for (let i = 0; i + seq.length <= t.length; i++) {
      for (let j = 0; j < seq.length; j++) if (t[i + j] !== seq[j]) continue outer;
      return true;
    }
    return false;
  };
  for (const { abbr, phrase } of ALIAS_PHRASES) {
    if (t.includes(abbr)) extra.push(...phrase);
    else if (has(phrase)) extra.push(abbr);
  }
  return extra.length ? [...t, ...extra] : t;
}

// ---------------------------------------------------------------------------------------------------------------
// Query

export interface Query {
  /** Stemmed words to match. */
  terms: string[];
  raw: string;
}

export function parseQuery(q: string): Query {
  const all = (fold(plain(q)).match(WORD) ?? []).filter(Boolean);
  // Drop filler words unless the whole query is filler ("how to" alone is still searched literally).
  const kept = all.filter((w) => !STOP.has(w));
  const terms = [...new Set((kept.length ? kept : all).map(stem))];
  return { terms, raw: q };
}

function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

// ---------------------------------------------------------------------------------------------------------------
// Index

interface IndexedItem<T> {
  item: T;
  /** token -> best weight among the fields that contain it */
  tokens: Map<string, number>;
  /** token -> the snippet field it came from, when that is where its best weight lies */
  snippetField: Map<string, string>;
  title: string;
}

export interface Searcher<T> {
  search(q: string): SearchOutcome<T>;
}

/**
 * Build a searcher over `items`. `fields` describes each item; it is called once per item, when the searcher is
 * created, so keep one searcher per collection (it is cheap to rebuild when the collection changes).
 */
export function createSearch<T>(items: T[], fields: (item: T) => SearchField[]): Searcher<T> {
  const indexed: IndexedItem<T>[] = items.map((item) => {
    const best = new Map<string, number>();
    const sum = new Map<string, number>();
    const snippetField = new Map<string, string>();
    const fs = fields(item);
    for (const f of fs) {
      if (!f.text) continue;
      for (const t of new Set(fieldTokens(f.text))) {
        sum.set(t, (sum.get(t) ?? 0) + f.weight);
        if (f.weight > (best.get(t) ?? 0)) {
          best.set(t, f.weight);
          if (f.snippet) snippetField.set(t, f.text);
          else snippetField.delete(t);
        }
      }
    }
    // A word's weight is its best field, plus a little for every other field that also uses it, so an item that is
    // about a word throughout outranks one that mentions it once in a heavy field.
    const tokens = new Map<string, number>();
    for (const [t, w] of best) tokens.set(t, w + 0.15 * Math.min((sum.get(t) ?? w) - w, 10));
    return { item, tokens, snippetField, title: fold(plain(fs[0]?.text ?? "")) };
  });
  const vocab = new Set(indexed.flatMap((d) => [...d.tokens.keys()]));

  /** The collection's words a query term should count as, with a quality factor for inexact matches. */
  function expand(term: string): Map<string, number> {
    const out = new Map<string, number>();
    if (vocab.has(term)) out.set(term, 1);
    // Prefix: for half-typed words, only when the word is not a complete word in the collection.
    if (!out.size && term.length >= 2)
      for (const v of vocab) if (v.startsWith(term)) out.set(v, 0.75);
    // Typo: only when there is neither an exact nor a prefix match anywhere.
    if (!out.size && term.length >= 5) {
      const max = term.length >= 8 ? 2 : 1;
      for (const v of vocab) if (editDistanceWithin(term, v, max)) out.set(v, 0.6);
    }
    return out;
  }

  return {
    search(raw: string): SearchOutcome<T> {
      const q = parseQuery(raw);
      if (!q.terms.length) return { results: [], partial: false, empty: true };
      const expanded = q.terms.map(expand);
      const phrase = fold(plain(raw)).trim();

      const scored = indexed.map((d) => {
        let score = 0;
        let matched = 0;
        let snippetText: string | undefined;
        // Words whose only evidence is in the snippet field: those are what the snippet should show.
        const hidden = new Set<string>();
        for (const alts of expanded) {
          let best = 0;
          let bestToken = "";
          for (const [tok, quality] of alts) {
            const w = d.tokens.get(tok);
            if (w && w * quality > best) {
              best = w * quality;
              bestToken = tok;
            }
          }
          if (best > 0) {
            matched++;
            score += best;
            const sf = d.snippetField.get(bestToken);
            if (sf) {
              snippetText ??= sf;
              hidden.add(bestToken);
            }
          }
        }
        if (phrase.length > 2 && d.title.includes(phrase)) score += 4;
        return { d, score, matched, snippetText, hidden };
      });

      const total = q.terms.length;
      let pool = scored.filter((s) => s.matched === total);
      let partial = false;
      if (!pool.length && total > 1) {
        const most = Math.max(...scored.map((s) => s.matched));
        if (most > 0) {
          pool = scored.filter((s) => s.matched === most);
          partial = true;
        }
      }
      pool.sort((a, b) => b.score - a.score);
      return {
        partial,
        empty: false,
        results: pool.map((s) => ({
          item: s.d.item,
          score: s.score,
          snippet: s.snippetText ? makeSnippet(s.snippetText, s.hidden) : undefined,
        })),
      };
    },
  };
}

/** A short excerpt of `text` around the first word whose stem is one of `terms`. */
export function makeSnippet(text: string, terms: Set<string>, radius = 70): Snippet | undefined {
  const src = plain(text).replace(/\s+/g, " ").trim();
  for (const m of src.matchAll(WORD)) {
    if (!terms.has(stem(fold(m[0])))) continue;
    const start = m.index;
    const end = start + m[0].length;
    const from = Math.max(0, src.lastIndexOf(" ", Math.max(0, start - radius)) + 1);
    const toSpace = src.indexOf(" ", Math.min(src.length, end + radius));
    const to = toSpace === -1 ? src.length : toSpace;
    return {
      before: (from > 0 ? "…" : "") + src.slice(from, start),
      hit: src.slice(start, end),
      after: src.slice(end, to) + (to < src.length ? "…" : ""),
    };
  }
  return undefined;
}
