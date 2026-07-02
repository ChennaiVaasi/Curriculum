import { Link } from "wouter";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Catalog, ChapterRecord } from "@/lib/types";

// ─── Chapter context menu ────────────────────────────────────────────────────

function ChapterMenu({ chapter, onDeleted }: { chapter: ChapterRecord; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleDelete() {
    if (!confirm(`Delete "${chapter.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted(chapter.id);
    } catch {
      alert("Could not delete this chapter. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = `/api/files/${chapter.id}?download=1`;
    a.download = chapter.originalFilename ?? `${chapter.title}.${chapter.fileType ?? "pdf"}`;
    a.click();
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
      <button
        aria-label="Chapter options"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        disabled={deleting}
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
      >
        {deleting ? <span className="text-xs">…</span> : <span className="text-lg leading-none tracking-[-2px]">•••</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 min-w-[9rem] rounded-2xl border border-stone-200 bg-white py-1.5 shadow-[0_8px_32px_-8px_rgba(41,37,36,0.28)]">
          <button onClick={handleDownload} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50">
            <span>↓</span> Download
          </button>
          <div className="mx-3 my-1 border-t border-stone-100" />
          <button onClick={handleDelete} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50">
            <span>✕</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

type FileTypeTab = "" | "pdf" | "pgn";

const FILE_TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pdf: { label: "PDF", bg: "bg-amber-100", text: "text-amber-800" },
  pgn: { label: "PGN", bg: "bg-emerald-100", text: "text-emerald-800" },
};

function FileTypeBadge({ fileType }: { fileType?: string }) {
  const style = FILE_TYPE_STYLES[fileType ?? ""] ?? { label: (fileType ?? "").toUpperCase() || "PDF", bg: "bg-stone-100", text: "text-stone-600" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// ─── Active filter pill ───────────────────────────────────────────────────────

function FilterPill({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
    >
      <span className="text-stone-400 text-[10px] uppercase tracking-wider">{label}</span>
      <span>{value}</span>
      <span className="text-stone-400">×</span>
    </button>
  );
}

// ─── Search suggestions dropdown ──────────────────────────────────────────────

type Suggestion = { label: string; kind: "theme" | "microTag" | "primaryTheme" | "opening" | "domain" | "phase" | "title" };

function SearchSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  const kindLabel: Record<Suggestion["kind"], string> = {
    title: "Chapter",
    theme: "Theme",
    primaryTheme: "Tag",
    microTag: "Micro-tag",
    opening: "Opening",
    domain: "Domain",
    phase: "Phase",
  };
  const kindColor: Record<Suggestion["kind"], string> = {
    title: "bg-stone-100 text-stone-600",
    theme: "bg-stone-100 text-stone-600",
    primaryTheme: "bg-amber-50 text-amber-700",
    microTag: "bg-violet-50 text-violet-700",
    opening: "bg-sky-50 text-sky-700",
    domain: "bg-teal-50 text-teal-700",
    phase: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-1.5 shadow-[0_8px_32px_-8px_rgba(41,37,36,0.28)]">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-stone-800 transition hover:bg-stone-50"
        >
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${kindColor[s.kind]}`}>
            {kindLabel[s.kind]}
          </span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [catalog, setCatalog] = useState<Catalog>({ books: [], chapters: [] });
  const [loading, setLoading] = useState(true);

  // Search & filter state
  const [query, setQuery] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [level, setLevel] = useState("");
  const [theme, setTheme] = useState("");
  const [phase, setPhase] = useState("");
  const [domain, setDomain] = useState("");
  const [primaryThemeFilter, setPrimaryThemeFilter] = useState("");
  const [microTagFilter, setMicroTagFilter] = useState("");
  const [fileTypeTab, setFileTypeTab] = useState<FileTypeTab>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bookTitle: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const book of catalog.books) map[book.id] = book.title;
    return map;
  }, [catalog.books]);

  // Base pool filtered by file type tab
  const chaptersForTab = useMemo(() =>
    fileTypeTab ? catalog.chapters.filter((c) => (c.fileType ?? "pdf") === fileTypeTab) : catalog.chapters,
    [catalog.chapters, fileTypeTab]
  );

  // Unique options for dropdowns (derived from current tab pool)
  const uniqueLevels = useMemo(() => [...new Set(chaptersForTab.map((c) => c.level))].filter(Boolean).sort(), [chaptersForTab]);
  const uniqueThemes = useMemo(() => [...new Set(chaptersForTab.map((c) => c.theme))].filter(Boolean).sort(), [chaptersForTab]);
  const uniquePhases = useMemo(() => [...new Set(chaptersForTab.map((c) => c.taxonomy?.phase))].filter(Boolean).sort() as string[], [chaptersForTab]);
  const uniqueDomains = useMemo(() => [...new Set(chaptersForTab.map((c) => c.taxonomy?.domain))].filter(Boolean).sort() as string[], [chaptersForTab]);
  const uniquePrimaryThemes = useMemo(() => {
    const set = new Set<string>();
    chaptersForTab.forEach((c) => c.taxonomy?.primaryThemes?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [chaptersForTab]);
  const uniqueMicroTags = useMemo(() => {
    const set = new Set<string>();
    chaptersForTab.forEach((c) => c.taxonomy?.microTags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [chaptersForTab]);

  // Full-text match helper
  function matchesQuery(chapter: ChapterRecord, q: string): boolean {
    if (!q) return true;
    const low = q.toLowerCase();
    const tx = chapter.taxonomy;
    return (
      chapter.title.toLowerCase().includes(low) ||
      (chapter.theme ?? "").toLowerCase().includes(low) ||
      (chapter.primarySkill ?? "").toLowerCase().includes(low) ||
      (chapter.secondarySkills ?? []).some((s) => s.toLowerCase().includes(low)) ||
      (chapter.notes ?? "").toLowerCase().includes(low) ||
      (bookTitle[chapter.bookId] ?? "").toLowerCase().includes(low) ||
      (tx?.primaryThemes ?? []).some((t) => t.toLowerCase().includes(low)) ||
      (tx?.microTags ?? []).some((t) => t.toLowerCase().includes(low)) ||
      (tx?.openingFamily ?? "").toLowerCase().includes(low) ||
      (tx?.openingVariation ?? "").toLowerCase().includes(low) ||
      (tx?.domain ?? "").toLowerCase().includes(low) ||
      (tx?.phase ?? "").toLowerCase().includes(low) ||
      (tx?.structures ?? []).some((t) => t.toLowerCase().includes(low)) ||
      (tx?.materialTags ?? []).some((t) => t.toLowerCase().includes(low))
    );
  }

  // Apply all filters
  const chapters: ChapterRecord[] = useMemo(() => {
    const q = query.trim();
    return chaptersForTab
      .filter((chapter) => {
        const tx = chapter.taxonomy;
        return (
          matchesQuery(chapter, q) &&
          (!level || chapter.level === level) &&
          (!theme || chapter.theme === theme) &&
          (!phase || tx?.phase === phase) &&
          (!domain || tx?.domain === domain) &&
          (!primaryThemeFilter || (tx?.primaryThemes ?? []).includes(primaryThemeFilter)) &&
          (!microTagFilter || (tx?.microTags ?? []).includes(microTagFilter))
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [chaptersForTab, query, level, theme, phase, domain, primaryThemeFilter, microTagFilter]);

  // Search suggestions
  const suggestions: Suggestion[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const results: Suggestion[] = [];
    const seen = new Set<string>();

    function add(label: string, kind: Suggestion["kind"]) {
      const key = `${kind}:${label}`;
      if (!seen.has(key) && label.toLowerCase().includes(q)) {
        seen.add(key);
        results.push({ label, kind });
      }
    }

    chaptersForTab.forEach((c) => {
      add(c.title, "title");
      if (c.theme) add(c.theme, "theme");
      if (c.taxonomy?.phase) add(c.taxonomy.phase, "phase");
      if (c.taxonomy?.domain) add(c.taxonomy.domain, "domain");
      if (c.taxonomy?.openingFamily) add(c.taxonomy.openingFamily, "opening");
      if (c.taxonomy?.openingVariation) add(c.taxonomy.openingVariation, "opening");
      (c.taxonomy?.primaryThemes ?? []).forEach((t) => add(t, "primaryTheme"));
      (c.taxonomy?.microTags ?? []).forEach((t) => add(t, "microTag"));
    });

    return results.slice(0, 10);
  }, [query, chaptersForTab]);

  function pickSuggestion(s: Suggestion) {
    setQuery("");
    setInputFocused(false);
    if (s.kind === "title") setQuery(s.label);
    else if (s.kind === "theme") setTheme(s.label);
    else if (s.kind === "phase") { setPhase(s.label); setShowAdvanced(true); }
    else if (s.kind === "domain") { setDomain(s.label); setShowAdvanced(true); }
    else if (s.kind === "primaryTheme") { setPrimaryThemeFilter(s.label); setShowAdvanced(true); }
    else if (s.kind === "microTag") { setMicroTagFilter(s.label); setShowAdvanced(true); }
    else if (s.kind === "opening") setQuery(s.label);
  }

  function clickBadge(kind: Suggestion["kind"], value: string) {
    if (kind === "theme") setTheme(value);
    else if (kind === "phase") { setPhase(value); setShowAdvanced(true); }
    else if (kind === "domain") { setDomain(value); setShowAdvanced(true); }
    else if (kind === "primaryTheme") { setPrimaryThemeFilter(value); setShowAdvanced(true); }
    else if (kind === "microTag") { setMicroTagFilter(value); setShowAdvanced(true); }
    else if (kind === "opening") setQuery(value);
  }

  function clearAll() {
    setQuery(""); setLevel(""); setTheme(""); setPhase(""); setDomain("");
    setPrimaryThemeFilter(""); setMicroTagFilter("");
  }

  const activeFilters = [
    level && { label: "Level", value: level, clear: () => setLevel("") },
    theme && { label: "Theme", value: theme, clear: () => setTheme("") },
    phase && { label: "Phase", value: phase, clear: () => setPhase("") },
    domain && { label: "Domain", value: domain, clear: () => setDomain("") },
    primaryThemeFilter && { label: "Tag", value: primaryThemeFilter, clear: () => setPrimaryThemeFilter("") },
    microTagFilter && { label: "Micro-tag", value: microTagFilter, clear: () => setMicroTagFilter("") },
  ].filter(Boolean) as { label: string; value: string; clear: () => void }[];

  const hasFilters = Boolean(query || activeFilters.length);

  const pdfCount = catalog.chapters.filter((c) => (c.fileType ?? "pdf") === "pdf").length;
  const pgnCount = catalog.chapters.filter((c) => c.fileType === "pgn").length;

  function handleDeleted(id: string) {
    setCatalog((prev) => ({ books: prev.books, chapters: prev.chapters.filter((c) => c.id !== id) }));
  }

  const tabs: { value: FileTypeTab; label: string; count: number }[] = [
    { value: "", label: "All", count: catalog.chapters.length },
    { value: "pdf", label: "PDFs", count: pdfCount },
    { value: "pgn", label: "PGN Games", count: pgnCount },
  ];

  return (
    <div className="grid gap-6">
      {/* Header card */}
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-col gap-5">
          {/* Title + tabs */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
              <p className="mt-1 text-sm text-stone-500">Search by title, theme, opening, tags, or micro-tags.</p>
            </div>
            <div className="flex gap-1 rounded-2xl bg-stone-100 p-1 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setFileTypeTab(tab.value); clearAll(); }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    fileTypeTab === tab.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    fileTypeTab === tab.value ? "bg-stone-100 text-stone-600" : "bg-stone-200 text-stone-500"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <svg className="h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 150)}
              placeholder="Search titles, themes, openings, tags, micro-tags…"
              className="w-full rounded-2xl border border-stone-300 bg-stone-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-3 flex items-center px-1 text-stone-400 hover:text-stone-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {inputFocused && (
              <SearchSuggestions suggestions={suggestions} onPick={pickSuggestion} />
            )}
          </div>

          {/* Quick filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            >
              <option value="">All levels</option>
              {uniqueLevels.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            >
              <option value="">All themes</option>
              {uniqueThemes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                showAdvanced || (phase || domain || primaryThemeFilter || microTagFilter)
                  ? "border-stone-800 bg-stone-900 text-white"
                  : "border-stone-300 bg-stone-50 text-stone-600 hover:border-stone-400 hover:bg-stone-100"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
              </svg>
              Advanced
              {(phase || domain || primaryThemeFilter || microTagFilter) && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-stone-900 leading-none">
                  {[phase, domain, primaryThemeFilter, microTagFilter].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                onClick={clearAll}
                className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-500 transition hover:border-stone-400 hover:text-stone-800"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Advanced filters panel */}
          {showAdvanced && (
            <div className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Phase */}
              <div className="grid gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Phase</label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
                >
                  <option value="">Any phase</option>
                  {uniquePhases.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* Domain */}
              <div className="grid gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
                >
                  <option value="">Any domain</option>
                  {uniqueDomains.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* Primary theme tag */}
              <div className="grid gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Tag</label>
                <select
                  value={primaryThemeFilter}
                  onChange={(e) => setPrimaryThemeFilter(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
                >
                  <option value="">Any tag</option>
                  {uniquePrimaryThemes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* Micro tag */}
              <div className="grid gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Micro-tag</label>
                <select
                  value={microTagFilter}
                  onChange={(e) => setMicroTagFilter(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
                >
                  <option value="">Any micro-tag</option>
                  {uniqueMicroTags.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <FilterPill key={`${f.label}:${f.value}`} label={f.label} value={f.value} onRemove={f.clear} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Results count bar */}
      {!loading && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-stone-500">
            {chapters.length === chaptersForTab.length
              ? `${chapters.length} chapter${chapters.length !== 1 ? "s" : ""}`
              : `${chapters.length} of ${chaptersForTab.length} chapters`}
          </p>
          {hasFilters && chapters.length === 0 && (
            <button onClick={clearAll} className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 text-sm text-stone-500">
          Loading library…
        </section>
      ) : chapters.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
          {fileTypeTab === "pgn"
            ? "No PGN games match your search. Try loosening the filters."
            : fileTypeTab === "pdf"
            ? "No PDF chapters match your search. Try loosening the filters."
            : "No chapters match your search. Try different keywords or clear the filters."}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chapters.map((chapter) => {
            const tx = chapter.taxonomy;
            const hasOpening = Boolean(tx?.openingFamily);
            const isTypicalPlanOnly = tx?.primaryThemes?.length === 1 && tx.primaryThemes[0] === "Typical plan";
            const showThemes = isTypicalPlanOnly && hasOpening ? [] : (tx?.primaryThemes ?? []);
            const openingLabel = tx?.openingVariation
              ? `${tx.openingFamily} · ${tx.openingVariation}`
              : tx?.openingFamily;

            return (
              <div
                key={chapter.id}
                className="relative grid gap-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)] transition hover:-translate-y-1 hover:border-stone-400"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-600">
                      {chapter.level}
                    </span>
                    <FileTypeBadge fileType={chapter.fileType} />
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {bookTitle[chapter.bookId] && (
                      <span className="text-xs text-stone-400 truncate max-w-[8rem] text-right">
                        {bookTitle[chapter.bookId]}
                      </span>
                    )}
                    <ChapterMenu chapter={chapter} onDeleted={handleDeleted} />
                  </div>
                </div>

                <Link href={`/chapters/${chapter.id}`} className="grid gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{chapter.title}</h2>
                    <p className="mt-2 text-sm text-stone-600">{chapter.theme}</p>
                  </div>

                  {tx && (
                    <>
                      {/* Phase + Domain pills */}
                      {(tx.phase || tx.domain) && (
                        <div className="flex flex-wrap gap-1.5">
                          {tx.phase && (
                            <button
                              onClickCapture={(e) => { e.preventDefault(); clickBadge("phase", tx.phase!); }}
                              className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100"
                            >
                              {tx.phase}
                            </button>
                          )}
                          {tx.domain && (
                            <button
                              onClickCapture={(e) => { e.preventDefault(); clickBadge("domain", tx.domain!); }}
                              className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 transition hover:bg-teal-100"
                            >
                              {tx.domain}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Opening + primary themes */}
                      {(showThemes.length > 0 || hasOpening) && (
                        <div className="flex flex-wrap gap-1.5">
                          {hasOpening && (
                            <button
                              onClickCapture={(e) => { e.preventDefault(); clickBadge("opening", tx.openingFamily!); }}
                              className="rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-medium text-sky-800 transition hover:bg-sky-100"
                            >
                              {openingLabel}
                            </button>
                          )}
                          {showThemes.map((t) => (
                            <button
                              key={t}
                              onClickCapture={(e) => { e.preventDefault(); clickBadge("primaryTheme", t); }}
                              className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Micro-tags */}
                      {(tx.microTags ?? []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 select-none">tags</span>
                          {(tx.microTags ?? []).map((t) => (
                            <button
                              key={t}
                              onClickCapture={(e) => { e.preventDefault(); clickBadge("microTag", t); }}
                              className="rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="rounded-[1.5rem] bg-stone-50 p-4 text-sm text-stone-700">
                    Primary skill: <span className="font-medium">{chapter.primarySkill}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
