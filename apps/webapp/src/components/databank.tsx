import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  MoreHorizontal,
  Pin,
  PinOff,
  Printer,
  Search,
} from "lucide-react";
import type { Course } from "@/data/types";
import { CodeBlock } from "@/components/code-block";
import { Inline, Tex } from "@/components/rich";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildItems, KINDS, toMarkdown, type Item, type Kind } from "@/lib/databank";
import { download } from "@/store/backup";
import { actions, useStore } from "@/store/store";
import { cn } from "@/lib/utils";

type Tab = Kind | "pinned";

/** Page numbers to show: first, last, and the neighbours of the current page, with ellipses between. */
function pageWindow(current: number, total: number): (number | "…")[] {
  const keep = new Set(
    [1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total),
  );
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Copy was blocked by the browser");
  }
}

function RowActions({ item, course, pinned }: { item: Item; course: Course; pinned: boolean }) {
  return (
    <div className="no-print flex shrink-0 items-center">
      {item.kind === "formula" && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy LaTeX"
          title="Copy LaTeX"
          onClick={() => void copy(item.tex, "LaTeX")}
        >
          <Copy />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={pinned ? "Unpin this item" : "Pin this item"}
        title={pinned ? "Unpin" : "Pin to my sheet"}
        aria-pressed={pinned}
        className={pinned ? "text-primary" : undefined}
        onClick={() => actions.togglePin(course.slug, item.id)}
      >
        {pinned ? <PinOff /> : <Pin />}
      </Button>
    </div>
  );
}

/** One dense row per item: just a name (and the formula, for formulas). Everything else is in the detail view. */
function Row({
  item,
  course,
  pinned,
  unitTag,
  onOpen,
}: {
  item: Item;
  course: Course;
  pinned: boolean;
  unitTag?: string;
  onOpen: () => void;
}) {
  const unitLabel = unitTag ? (
    <span
      className="mr-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      title={course.modules.find((m) => m.id === item.unit)?.title}
    >
      {unitTag}
    </span>
  ) : null;

  return (
    <li className="flex items-center gap-2 pr-2 hover:bg-muted/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 px-3 py-2.5 text-left"
        aria-label={`${item.title}: show details`}
      >
        <span
          className={cn(
            "flex min-w-0 items-center font-medium",
            item.kind === "formula" ? "w-44 shrink-0 sm:w-56" : "flex-1",
          )}
        >
          {unitLabel}
          <span className="truncate">
            <Inline text={item.title} />
          </span>
        </span>
        {item.kind === "formula" && (
          <span className="hidden min-w-0 flex-1 overflow-hidden sm:block" role="math">
            <Tex tex={item.tex} display />
          </span>
        )}
        {item.kind === "tool" && (
          <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
            {item.blurb}
          </span>
        )}
        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </button>
      <RowActions item={item} course={course} pinned={pinned} />
    </li>
  );
}

/** Full explanation for one item, opened from its row. */
function ItemDetail({
  item,
  course,
  onClose,
}: {
  item: Item | null;
  course: Course;
  onClose: () => void;
}) {
  const pins = useStore((s) => s.pins);
  const unit = item ? course.modules.find((m) => m.id === item.unit) : undefined;
  const pinned = !!(item && pins[`${course.slug}/${item.id}`]);
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl">
                <Inline text={item.title} />
              </DialogTitle>
              <DialogDescription>
                {KINDS.find((k) => k.key === item.kind)!.label}
                {unit ? ` from ${unit.title}` : ""}
              </DialogDescription>
            </DialogHeader>
            {item.kind === "formula" && (
              <div className="space-y-3">
                <div
                  className="overflow-x-auto rounded-lg bg-muted/50 px-4 py-4 text-lg"
                  role="math"
                >
                  <Tex tex={item.tex} display />
                </div>
                {item.caption && (
                  <p className="leading-relaxed text-muted-foreground">{item.caption}</p>
                )}
                <Link
                  to={`/learn/${course.slug}/${item.lessonId}`}
                  className="inline-block font-medium text-primary"
                >
                  Read the lesson: {item.lessonTitle}
                </Link>
              </div>
            )}
            {item.kind === "fact" && (
              <p className="leading-relaxed">
                <Inline text={item.text} />
              </p>
            )}
            {item.kind === "term" && <p className="leading-relaxed">{item.def}</p>}
            {item.kind === "code" && (
              <div className="min-w-0 space-y-2">
                {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
                <CodeBlock code={item.code} />
              </div>
            )}
            {item.kind === "tool" && (
              <div className="space-y-3">
                <p className="text-muted-foreground">{item.blurb}</p>
                <Link
                  to={`/learn/${course.slug}/labs/${item.unit}?lab=${item.labId}`}
                  className="inline-flex items-center gap-1.5 font-medium text-primary"
                >
                  <FlaskConical className="size-4" /> Open the tool
                </Link>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {item.kind === "formula" && (
                <Button variant="outline" size="sm" onClick={() => void copy(item.tex, "LaTeX")}>
                  <Copy /> Copy LaTeX
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.togglePin(course.slug, item.id)}
              >
                {pinned ? <PinOff /> : <Pin />} {pinned ? "Unpin" : "Pin to my sheet"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Personal databank for the given units. One type at a time (tabs), optional unit filter, dense rows.
 * Full page by default; `compact` is the drawer used inside a unit.
 */
export function Databank({
  course,
  units,
  compact = false,
  initialQuery = "",
}: {
  course: Course;
  units: string[];
  compact?: boolean;
  initialQuery?: string;
}) {
  const pins = useStore((s) => s.pins);
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("formula");
  const [unit, setUnit] = useState<string>("all");
  const [detail, setDetail] = useState<Item | null>(null);
  const [page, setPage] = useState(1);
  // Hash routing: a bare "#" link would leave the page, so point at the current route instead.
  const loc = useLocation();
  const here = `#${loc.pathname}${loc.search}`;

  const base = useMemo(
    () => buildItems(course).filter((i) => units.includes(i.unit)),
    [course, units],
  );
  const isPinned = (i: Item) => !!pins[`${course.slug}/${i.id}`];
  // Items matching the search and unit filter, before the tab is applied (so tab counts stay honest).
  const matching = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    return base.filter(
      (i) =>
        (unit === "all" || i.unit === unit) &&
        tokens.every((t) => i.search.toLowerCase().includes(t)),
    );
  }, [base, q, unit]);
  const count = (t: Tab) =>
    t === "pinned" ? matching.filter(isPinned).length : matching.filter((i) => i.kind === t).length;
  const tabs: Tab[] = ["pinned", ...KINDS.map((k) => k.key)];
  const visibleTabs = tabs.filter(
    (t) => base.some((i) => (t === "pinned" ? isPinned(i) : i.kind === t)) || t !== "pinned",
  );
  const active: Tab = count(tab) > 0 ? tab : (visibleTabs.find((t) => count(t) > 0) ?? tab);
  const rows = matching.filter((i) => (active === "pinned" ? isPinned(i) : i.kind === active));
  const pageSize = compact ? 8 : 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  // Back to page 1 whenever the list itself changes.
  useEffect(() => setPage(1), [q, unit, active, units]);
  const showUnitTag = unit === "all" && units.length > 1;
  const unitOptions = [
    { value: "all", label: "All units" },
    ...course.modules
      .filter((m) => units.includes(m.id))
      .map((m) => ({ value: m.id, label: `Unit ${course.modules.indexOf(m) + 1}: ${m.title}` })),
  ];
  const exportMd = () =>
    download(new Blob([toMarkdown(course, matching)], { type: "text/markdown" }), "my-databank.md");

  return (
    <div className="min-w-0 space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the databank"
          />
        </div>
        {!compact && units.length > 1 && (
          <Select value={unit} onValueChange={(v) => setUnit(v as string)} items={unitOptions}>
            <SelectTrigger className="h-10 w-60" aria-label="Filter by unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                aria-label="Export or print"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-52">
            <DropdownMenuItem
              className="whitespace-nowrap"
              onClick={exportMd}
              disabled={!matching.length}
            >
              <Download /> Export as Markdown
            </DropdownMenuItem>
            {!compact && (
              <DropdownMenuItem className="whitespace-nowrap" onClick={() => window.print()}>
                <Printer /> Print
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={active} onValueChange={(v) => setTab(v as Tab)} className="no-print">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto overflow-y-hidden">
          {visibleTabs.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="flex-none px-3"
              disabled={count(t) === 0 && t !== active}
            >
              {t === "pinned" ? "Pinned" : KINDS.find((k) => k.key === t)!.plural}
              <span className="ml-1.5 text-muted-foreground">{count(t)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {active === "pinned"
            ? "Nothing pinned yet. Use the pin on any row to keep it here."
            : "Nothing matches. Clear the search or choose another unit."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {pageRows.map((i) => (
            <Row
              key={i.id}
              item={i}
              course={course}
              pinned={isPinned(i)}
              unitTag={
                showUnitTag ? `U${course.modules.findIndex((m) => m.id === i.unit) + 1}` : undefined
              }
              onOpen={() => setDetail(i)}
            />
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav
          className="no-print flex flex-wrap items-center justify-between gap-2 pt-1"
          aria-label="Pagination"
        >
          <p className="text-sm text-muted-foreground" role="status">
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} of{" "}
            {rows.length}
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={here}
                  text="Previous"
                  aria-disabled={current === 1}
                  className={current === 1 ? "pointer-events-none opacity-50" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(current - 1);
                  }}
                />
              </PaginationItem>
              {pageWindow(current, totalPages).map((n, k) => (
                <PaginationItem key={`${n}-${k}`}>
                  {n === "…" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href={here}
                      isActive={n === current}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(n);
                      }}
                    >
                      {n}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={here}
                  text="Next"
                  aria-disabled={current === totalPages}
                  className={current === totalPages ? "pointer-events-none opacity-50" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(current + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </nav>
      )}
      <ItemDetail item={detail} course={course} onClose={() => setDetail(null)} />
    </div>
  );
}
