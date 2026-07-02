import { Link } from "wouter";
import { useMemo, useState } from "react";
import { FEN_NOTEBOOK_KEY, notebookToPgn } from "@/lib/fen";
import {
  appendImportCandidates,
  candidatesFromPgnText,
  isValidFen,
  makePositionId,
  readImportCandidates,
  readNotebookEntries,
  readNotebooks,
  writeImportCandidates,
  writeNotebookEntries,
  writeNotebooks,
  type ImportCandidate,
  type NotebookEntry,
  type PositionNotebook,
} from "@/lib/position-workflow";

type SavedFilter = "all" | "saved" | "unsaved";

const PIECES: Record<string, string> = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
};

function BoardPreview({ fen }: { fen: string }) {
  const board = fen.split(/\s+/)[0] || "8/8/8/8/8/8/8/8";
  const squares = board
    .split("/")
    .flatMap((rank) =>
      [...rank].flatMap((char) =>
        /\d/.test(char) ? Array(Number(char)).fill("") : [char],
      ),
    );
  return (
    <div className="grid h-28 w-28 shrink-0 grid-cols-8 overflow-hidden rounded-xl border border-stone-300 bg-stone-100">
      {Array.from({ length: 64 }).map((_, idx) => (
        <div
          key={idx}
          className={`grid place-items-center text-sm ${(Math.floor(idx / 8) + idx) % 2 ? "bg-stone-500 text-amber-50" : "bg-amber-100 text-stone-900"}`}
        >
          {PIECES[squares[idx]] || ""}
        </div>
      ))}
    </div>
  );
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function PositionSearchPage() {
  const [candidates, setCandidates] = useState<ImportCandidate[]>(() =>
    readImportCandidates(),
  );
  const [notebooks, setNotebooks] = useState<PositionNotebook[]>(() =>
    readNotebooks(),
  );
  const [entries, setEntries] = useState<NotebookEntry[]>(() =>
    readNotebookEntries(FEN_NOTEBOOK_KEY),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [filters, setFilters] = useState({
    hasPgn: false,
    fenOnly: false,
    validFen: false,
    duplicate: false,
  });
  const [savedFilter, setSavedFilter] = useState<SavedFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [targetNotebookId, setTargetNotebookId] = useState(
    notebooks[0]?.id || "",
  );
  const [newNotebookName, setNewNotebookName] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [status, setStatus] = useState("");

  const savedCandidateIds = useMemo(
    () => new Set(entries.map((entry) => entry.candidateId).filter(Boolean)),
    [entries],
  );
  const selectedCandidates = candidates.filter(
    (candidate) => selected.has(candidate.id) && !candidate.deleted,
  );
  const allTags = [
    ...new Set(candidates.flatMap((candidate) => candidate.tags)),
  ].sort();

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const requiredTags = splitTags(tagFilter).map((tag) => tag.toLowerCase());
    return candidates.filter((candidate) => {
      if (candidate.deleted) return false;
      const haystack = [
        candidate.title,
        candidate.fen,
        candidate.pgn,
        candidate.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.hasPgn && !candidate.pgn) return false;
      if (filters.fenOnly && candidate.pgn) return false;
      if (filters.validFen && candidate.validationStatus !== "valid")
        return false;
      if (filters.duplicate && !candidate.duplicate) return false;
      if (savedFilter === "saved" && !savedCandidateIds.has(candidate.id))
        return false;
      if (savedFilter === "unsaved" && savedCandidateIds.has(candidate.id))
        return false;
      if (
        requiredTags.length &&
        !requiredTags.every((tag) =>
          candidate.tags.map((t) => t.toLowerCase()).includes(tag),
        )
      )
        return false;
      return true;
    });
  }, [
    candidates,
    entries,
    filters,
    query,
    savedCandidateIds,
    savedFilter,
    tagFilter,
  ]);

  function persistCandidates(next: ImportCandidate[]) {
    setCandidates(next);
    writeImportCandidates(next);
  }

  function toggleCandidate(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function importPgnFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const batches = await Promise.all(
      files.map(async (file) =>
        candidatesFromPgnText(await file.text(), file.name, ["imported"]),
      ),
    );
    const next = batches.flat();
    appendImportCandidates(next as ImportCandidate[]);
    setCandidates(readImportCandidates());
    setStatus(
      `Created ${next.length} import candidate${next.length === 1 ? "" : "s"}. Importing did not save them to a notebook.`,
    );
    event.target.value = "";
  }

  function addTagsToSelected() {
    const tags = splitTags(
      window.prompt("Tags to add, comma separated", "") || "",
    );
    if (!tags.length) return;
    persistCandidates(
      candidates.map((candidate) =>
        selected.has(candidate.id)
          ? { ...candidate, tags: [...new Set([...candidate.tags, ...tags])] }
          : candidate,
      ),
    );
    setStatus(
      `Added tags to ${selected.size} candidate${selected.size === 1 ? "" : "s"}.`,
    );
  }

  async function copySelectedPgn() {
    const pgn = selectedCandidates
      .map(
        (candidate) =>
          candidate.pgn ||
          `[Event "${candidate.title}"]\n[SetUp "1"]\n[FEN "${candidate.fen}"]\n\n*`,
      )
      .join("\n\n");
    await navigator.clipboard.writeText(pgn);
    setStatus(
      `Copied PGN for ${selectedCandidates.length} candidate${selectedCandidates.length === 1 ? "" : "s"}.`,
    );
  }

  function deleteSelected() {
    persistCandidates(
      candidates.map((candidate) =>
        selected.has(candidate.id)
          ? { ...candidate, deleted: true }
          : candidate,
      ),
    );
    setSelected(new Set());
    setStatus(
      "Selected candidates were removed from review. Notebook entries were not changed.",
    );
  }

  function addToNotebook(ids = selected) {
    setSelected(new Set(ids));
    setModalOpen(true);
  }

  function saveToNotebook() {
    const now = new Date().toISOString();
    let notebookId = targetNotebookId;
    let nextNotebooks = notebooks;
    if (newNotebookName.trim()) {
      const notebook = {
        id: makePositionId("book"),
        name: newNotebookName.trim(),
        createdAt: now,
        updatedAt: now,
      };
      nextNotebooks = [notebook, ...notebooks];
      notebookId = notebook.id;
      writeNotebooks(nextNotebooks);
      setNotebooks(nextNotebooks);
      setTargetNotebookId(notebook.id);
    }
    if (!notebookId)
      return setStatus("Choose or create a notebook before saving.");
    const extraTags = splitTags(saveTags);
    const existingKeys = new Set(
      entries.map(
        (entry) =>
          `${entry.notebookId}|${entry.fen || entry.pgn}|${entry.candidateId || ""}`,
      ),
    );
    const additions = selectedCandidates
      .filter((candidate) => candidate.fen || candidate.pgn)
      .flatMap((candidate) => {
        const key = `${notebookId}|${candidate.fen || candidate.pgn}|${candidate.id}`;
        if (skipDuplicates && existingKeys.has(key)) return [];
        existingKeys.add(key);
        return [
          {
            id: makePositionId("entry"),
            notebookId,
            title: candidate.title,
            fen: candidate.fen,
            pgn: candidate.pgn,
            candidateId: candidate.id,
            tags: [...new Set([...candidate.tags, ...extraTags])],
            chapterId: "position-search",
            chapterTitle: candidate.title,
            bookTitle: nextNotebooks.find(
              (notebook) => notebook.id === notebookId,
            )?.name,
            sourceMessage: "Added from Position Search",
            savedAt: now,
          } satisfies NotebookEntry,
        ];
      });
    const nextEntries = [...additions, ...entries];
    writeNotebookEntries(FEN_NOTEBOOK_KEY, nextEntries);
    setEntries(nextEntries);
    setModalOpen(false);
    setSelected(new Set());
    setSaveTags("");
    setNewNotebookName("");
    setStatus(
      `Added ${additions.length} selected candidate${additions.length === 1 ? "" : "s"} to notebook.`,
    );
  }

  return (
    <div className="grid gap-6 pb-24">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
              Review before saving
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Position Search
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              ImportCandidates can exist on their own. Searching and importing
              never create NotebookEntry records; only Add to Notebook saves
              curated positions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700">
              Import PGN candidates
              <input
                type="file"
                accept=".pgn"
                multiple
                onChange={importPgnFiles}
                className="sr-only"
              />
            </label>
            <Link
              href="/notebook"
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
            >
              Open notebooks
            </Link>
          </div>
        </div>
        {status ? (
          <p className="mt-4 text-sm text-stone-500">{status}</p>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-stone-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, FEN, PGN, and tags"
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-stone-900"
          />
          <select
            value={savedFilter}
            onChange={(e) => setSavedFilter(e.target.value as SavedFilter)}
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm"
          >
            <option value="all">Already saved / Not saved</option>
            <option value="saved">Already saved</option>
            <option value="unsaved">Not saved</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-700">
          {(
            [
              ["hasPgn", "Has PGN"],
              ["fenOnly", "FEN only"],
              ["validFen", "Valid FEN"],
              ["duplicate", "Duplicate"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) =>
                  setFilters((cur) => ({ ...cur, [key]: e.target.checked }))
                }
                className="accent-stone-900"
              />
              {label}
            </label>
          ))}
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            list="candidate-tags"
            placeholder="Tags"
            className="rounded-full border border-stone-300 px-3 py-2"
          />
          <datalist id="candidate-tags">
            {allTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {filteredCandidates.map((candidate) => (
          <article
            key={candidate.id}
            className={`rounded-[2rem] border bg-white p-5 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)] ${selected.has(candidate.id) ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200"}`}
          >
            <div className="flex gap-4">
              <input
                type="checkbox"
                checked={selected.has(candidate.id)}
                onChange={() => toggleCandidate(candidate.id)}
                className="mt-2 h-4 w-4 accent-stone-900"
              />
              <BoardPreview fen={candidate.fen} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{candidate.title}</h2>
                  {candidate.pgn ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      PGN available
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {candidate.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-3 truncate rounded-full bg-amber-50 px-3 py-1 font-mono text-xs text-stone-700">
                  {candidate.fen || "No FEN extracted"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={
                      candidate.validationStatus === "valid"
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }
                  >
                    {candidate.validationStatus === "valid" &&
                    isValidFen(candidate.fen)
                      ? "Valid FEN"
                      : candidate.validationStatus}
                  </span>
                  {candidate.duplicate ? (
                    <span className="text-amber-700">Duplicate</span>
                  ) : null}
                  {savedCandidateIds.has(candidate.id) ? (
                    <span className="text-stone-500">Already saved</span>
                  ) : (
                    <span className="text-stone-500">Not saved</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addToNotebook(new Set([candidate.id]))}
                  className="mt-4 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
                >
                  Add to Notebook
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 px-6 py-4 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => addToNotebook()}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
              >
                Add to Notebook
              </button>
              <button
                onClick={addTagsToSelected}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Add Tags
              </button>
              <button
                onClick={copySelectedPgn}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Copy PGN
              </button>
              <button
                onClick={deleteSelected}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Delete from Review
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/40 p-6">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Add selected to notebook</h2>
            <p className="mt-1 text-sm text-stone-600">
              Choose an existing notebook or create a new notebook inline.
            </p>
            <div className="mt-5 grid gap-3">
              <select
                value={targetNotebookId}
                onChange={(e) => setTargetNotebookId(e.target.value)}
                className="rounded-2xl border border-stone-300 px-4 py-3"
              >
                <option value="">Choose existing notebook</option>
                {notebooks.map((notebook) => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.name}
                  </option>
                ))}
              </select>
              <input
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                placeholder="Or create new notebook"
                className="rounded-2xl border border-stone-300 px-4 py-3"
              />
              <input
                value={saveTags}
                onChange={(e) => setSaveTags(e.target.value)}
                placeholder="Add tags before saving"
                className="rounded-2xl border border-stone-300 px-4 py-3"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="accent-stone-900"
                />
                Skip duplicates
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveToNotebook}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
              >
                Add selected to notebook
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
