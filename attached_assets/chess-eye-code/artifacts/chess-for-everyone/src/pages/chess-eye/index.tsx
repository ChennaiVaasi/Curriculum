import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type {
  PieceDropHandlerArgs,
  SquareHandlerArgs,
  PositionDataType,
} from "react-chessboard";
import { Chess } from "chess.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import ImageCropper from "./ImageCropper";
import {
  Eye,
  ScanLine,
  BookMarked,
  RotateCcw,
  FlipHorizontal,
  Copy,
  Play,
  Square as StopIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Save,
  Trash2,
  Loader2,
  ArrowRight,
  Plus,
  Brain,
  BookOpen,
  Pencil,
  Camera,
  Crop,
  FileText,
  Download,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type PieceCode =
  | "wK" | "wQ" | "wR" | "wB" | "wN" | "wP"
  | "bK" | "bQ" | "bR" | "bB" | "bN" | "bP";
type BoardPosition = Record<string, PieceCode>;

const PALETTE: { code: PieceCode; sym: string; title: string }[] = [
  { code: "wK", sym: "♔", title: "White King" },
  { code: "wQ", sym: "♕", title: "White Queen" },
  { code: "wR", sym: "♖", title: "White Rook" },
  { code: "wB", sym: "♗", title: "White Bishop" },
  { code: "wN", sym: "♘", title: "White Knight" },
  { code: "wP", sym: "♙", title: "White Pawn" },
  { code: "bK", sym: "♚", title: "Black King" },
  { code: "bQ", sym: "♛", title: "Black Queen" },
  { code: "bR", sym: "♜", title: "Black Rook" },
  { code: "bB", sym: "♝", title: "Black Bishop" },
  { code: "bN", sym: "♞", title: "Black Knight" },
  { code: "bP", sym: "♟", title: "Black Pawn" },
];

function fenToPosition(fen: string): BoardPosition {
  const pos: BoardPosition = {};
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, ri) => {
    let fi = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        fi += parseInt(ch);
      } else {
        const sq = `${"abcdefgh"[fi]}${8 - ri}`;
        pos[sq] = `${ch === ch.toUpperCase() ? "w" : "b"}${ch.toUpperCase()}` as PieceCode;
        fi++;
      }
    }
  });
  return pos;
}

function boardPositionToV5(pos: BoardPosition): PositionDataType {
  const out: PositionDataType = {};
  for (const [sq, code] of Object.entries(pos)) {
    out[sq] = { pieceType: code };
  }
  return out;
}

function positionToFen(pos: BoardPosition, side: string): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of "abcdefgh") {
      const pc = pos[`${file}${rank}`];
      if (pc) {
        if (empty) { row += empty; empty = 0; }
        row += pc[0] === "w" ? pc[1] : pc[1].toLowerCase();
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${side} - - 0 1`;
}

interface EngineLine {
  multipv: number;
  eval: number;
  mate: number | null;
  depth: number;
  san: string[];
}

interface ScanPosition {
  fen: string;
  confidence: number;
  sideToMove: string;
  notes?: string;
  // Squares where the per-square scan passes disagreed — surfaced so the user
  // can double-check them in Edit mode. Only set by the per-square pipeline.
  lowConfidenceSquares?: string[];
}

interface SavedPosition {
  id: number;
  title: string;
  fen: string;
  pgn?: string | null;
  notes?: string | null;
  engineEval?: number | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseInfoLine(line: string, currentFen: string): EngineLine | null {
  if (!line.includes(" pv ") || !line.includes("score")) return null;

  const depthMatch = line.match(/\bdepth (\d+)/);
  if (!depthMatch || parseInt(depthMatch[1]) < 2) return null;

  const multipvMatch = line.match(/\bmultipv (\d+)/);
  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  const pvMatch = line.match(/\bpv (.+)/);

  const uciMoves = pvMatch ? pvMatch[1].trim().split(" ").slice(0, 16) : [];

  let sanMoves: string[] = [];
  try {
    const g = new Chess(currentFen);
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion =
        uci.length === 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
      const m = g.move({ from, to, promotion: promotion ?? "q" });
      if (!m) break;
      sanMoves.push(m.san);
    }
  } catch {
    // ignore
  }

  return {
    multipv: multipvMatch ? parseInt(multipvMatch[1]) : 1,
    eval: cpMatch ? parseInt(cpMatch[1]) : 0,
    mate: mateMatch ? parseInt(mateMatch[1]) : null,
    depth: parseInt(depthMatch[1]),
    san: sanMoves,
  };
}

function evalToWhitePercent(cp: number, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 94 : 6;
  return Math.max(4, Math.min(96, 50 + 50 * (2 / (1 + Math.exp(-cp / 170)) - 1)));
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Downscale + JPEG-compress an image so camera photos don't blow past the
// server's request-size limit and Gemini gets a reasonably sized image.
async function downscaleImage(
  file: File,
  maxDim = 2000,
  quality = 0.85,
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { base64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" };
    }
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL("image/jpeg", quality);
    return { base64: out.split(",")[1], mimeType: "image/jpeg" };
  } catch {
    // If anything goes wrong, fall back to the original bytes
    return { base64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" };
  }
}

// Slice a straightened board image into 64 cells and lay them out on a labelled
// 8×8 montage so the model classifies each square in isolation rather than
// localizing pieces on a dense board. Magenta gutters separate the cells; files
// a–h are labelled across the top and ranks 8→1 down the left, matching the
// server's per-square prompt. Assumes standard orientation (white at the
// bottom); the user can flip/fix in Edit mode if the photo was inverted.
async function buildBoardMontage(
  file: File,
): Promise<{ base64: string; mimeType: string } | null> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  if (!W || !H) return null;

  const cellW = W / 8;
  const cellH = H / 8;
  const tile = 80; // rendered size of each cell in the montage
  const gutter = 8; // magenta separator between cells
  const margin = 28; // border strip carrying the a–h / 8–1 labels
  // Small overscan so tall pieces that spill slightly past their square are
  // still captured in the cell that owns the piece's base.
  const padX = cellW * 0.06;
  const padY = cellH * 0.06;

  const size = margin + 8 * tile + 9 * gutter;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ff00ff"; // gutters + label strip background
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const files = "abcdefgh";
  for (let c = 0; c < 8; c++) {
    const x = margin + gutter + c * (tile + gutter) + tile / 2;
    ctx.fillText(files[c], x, margin / 2);
  }
  for (let r = 0; r < 8; r++) {
    const y = margin + gutter + r * (tile + gutter) + tile / 2;
    ctx.fillText(String(8 - r), margin / 2, y);
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let sx = c * cellW - padX;
      let sy = r * cellH - padY;
      let sw = cellW + 2 * padX;
      let sh = cellH + 2 * padY;
      sx = Math.max(0, sx);
      sy = Math.max(0, sy);
      sw = Math.min(W - sx, sw);
      sh = Math.min(H - sy, sh);
      const dx = margin + gutter + c * (tile + gutter);
      const dy = margin + gutter + r * (tile + gutter);
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, tile, tile);
    }
  }

  const out = canvas.toDataURL("image/jpeg", 0.92);
  return { base64: out.split(",")[1], mimeType: "image/jpeg" };
}

const STOCKFISH_CDN =
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChessEyePage() {
  // Chess game
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [posHistory, setPosHistory] = useState<string[]>([
    gameRef.current.fen(),
  ]);
  const [histIdx, setHistIdx] = useState(0);
  const [moveList, setMoveList] = useState<string[]>([]);
  const [boardFlipped, setBoardFlipped] = useState(false);

  // Responsive board width
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(440);
  useEffect(() => {
    const update = () => {
      const el = boardContainerRef.current;
      if (!el) return;
      const available = el.clientWidth - 20;
      const byHeight = window.innerHeight - 360;
      setBoardWidth(Math.max(240, Math.min(480, available, byHeight)));
    };
    update();
    window.addEventListener("resize", update);
    const obs = new ResizeObserver(update);
    if (boardContainerRef.current) obs.observe(boardContainerRef.current);
    return () => { window.removeEventListener("resize", update); obs.disconnect(); };
  }, []);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editPos, setEditPos] = useState<BoardPosition>({});
  const [editSide, setEditSide] = useState<"w" | "b">("w");
  const [selectedPiece, setSelectedPiece] = useState<PieceCode | null>(null);

  // Engine
  const engineWorkerRef = useRef<Worker | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineLines, setEngineLines] = useState<EngineLine[]>([]);
  const [engineDepth, setEngineDepth] = useState(0);
  const [multiPV, setMultiPV] = useState(3);
  const [targetDepth, setTargetDepth] = useState(20);
  const [evalCp, setEvalCp] = useState(0);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const pendingLinesRef = useRef<Map<number, EngineLine>>(new Map());
  const currentFenRef = useRef(fen);
  useEffect(() => {
    currentFenRef.current = fen;
  }, [fen]);

  // Board annotations
  const [arrows, setArrows] = useState<[string, string, string][]>([]);
  const [highlights, setHighlights] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [arrowColor, setArrowColor] = useState<string>("green");

  // Dialogs
  const [showFenDialog, setShowFenDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fenInput, setFenInput] = useState("");
  const [pgnInput, setPgnInput] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Scan tab
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanPosition[]>([]);
  const [pdfProgress, setPdfProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop-before-scan
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);

  // Camera capture
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Score Sheet tab
  const [ssFile, setSsFile] = useState<File | null>(null);
  const [ssPreviewUrl, setSsPreviewUrl] = useState<string | null>(null);
  const [ssScanning, setSsScanning] = useState(false);
  const [ssScanned, setSsScanned] = useState(false);
  const [ssTags, setSsTags] = useState<{
    event: string;
    site: string;
    date: string;
    round: string;
    white: string;
    black: string;
    result: string;
  }>({
    event: "",
    site: "",
    date: "",
    round: "",
    white: "",
    black: "",
    result: "*",
  });
  const [ssMoves, setSsMoves] = useState<string[]>([]);
  const [ssConfidence, setSsConfidence] = useState<number | null>(null);
  const [ssNotes, setSsNotes] = useState("");
  const [ssPly, setSsPly] = useState(0);
  const ssFileInputRef = useRef<HTMLInputElement>(null);
  const ssCameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Library tab
  const [savedPositions, setSavedPositions] = useState<SavedPosition[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("analyze");

  // ── Stockfish init ───────────────────────────────────────────────────────
  useEffect(() => {
    let worker: Worker | null = null;
    let unmounted = false;

    fetch(STOCKFISH_CDN)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((code) => {
        if (unmounted) return;
        const blob = new Blob([code], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
        URL.revokeObjectURL(url);

        worker.onerror = () => {
          toast.error("Chess engine failed to initialise.");
        };

        worker.onmessage = (e: MessageEvent<string>) => {
          const line: string = e.data;
          if (line === "uciok") {
            worker?.postMessage("isready");
          } else if (line === "readyok") {
            setEngineReady(true);
          } else if (line.startsWith("info depth")) {
            const parsed = parseInfoLine(line, currentFenRef.current);
            if (parsed) {
              pendingLinesRef.current.set(parsed.multipv, parsed);
              const sorted = Array.from(pendingLinesRef.current.values()).sort(
                (a, b) => a.multipv - b.multipv
              );
              setEngineLines([...sorted]);
              setEngineDepth(parsed.depth);
              if (parsed.multipv === 1) {
                setEvalCp(parsed.eval);
                setEvalMate(parsed.mate);
              }
            }
          } else if (line.startsWith("bestmove")) {
            setEngineRunning(false);
          }
        };

        worker.postMessage("uci");
        engineWorkerRef.current = worker;
      })
      .catch(() => {
        toast.error("Chess engine failed to load — check your connection.");
      });

    return () => {
      unmounted = true;
      worker?.terminate();
    };
  }, []);

  // ── Engine controls ──────────────────────────────────────────────────────
  const analyzePingedRef = useRef(false);
  const startAnalysis = useCallback(() => {
    const w = engineWorkerRef.current;
    if (!w || !engineReady) return;
    // Record that this user used the "analyze" tool (once per page load).
    // Fire-and-forget: anonymous users are silently ignored server-side.
    if (!analyzePingedRef.current) {
      analyzePingedRef.current = true;
      fetch("/api/chess-eye/usage", { method: "POST" }).catch(() => {});
    }
    pendingLinesRef.current.clear();
    setEngineLines([]);
    setEngineDepth(0);
    setEngineRunning(true);
    w.postMessage(`setoption name MultiPV value ${multiPV}`);
    w.postMessage(`position fen ${currentFenRef.current}`);
    w.postMessage(`go depth ${targetDepth}`);
  }, [engineReady, multiPV, targetDepth]);

  const stopAnalysis = useCallback(() => {
    engineWorkerRef.current?.postMessage("stop");
    setEngineRunning(false);
  }, []);

  // ── Board move handler ───────────────────────────────────────────────────
  const onDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false;
      const pieceType = piece.pieceType;
      const isPromotion =
        pieceType[1] === "P" &&
        ((pieceType[0] === "w" && targetSquare[1] === "8") ||
          (pieceType[0] === "b" && targetSquare[1] === "1"));

      try {
        const move = gameRef.current.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: isPromotion ? "q" : undefined,
        });
        if (!move) return false;
      } catch {
        return false;
      }

      const newFen = gameRef.current.fen();
      setFen(newFen);
      setMoveList(gameRef.current.history());
      setPosHistory((prev) => {
        const sliced = prev.slice(0, histIdx + 1);
        return [...sliced, newFen];
      });
      setHistIdx((prev) => prev + 1);
      setArrows([]);
      setHighlights({});

      if (engineRunning) {
        engineWorkerRef.current?.postMessage("stop");
        setTimeout(() => {
          const w = engineWorkerRef.current;
          if (!w) return;
          pendingLinesRef.current.clear();
          setEngineLines([]);
          setEngineRunning(true);
          w.postMessage(`setoption name MultiPV value ${multiPV}`);
          w.postMessage(`position fen ${newFen}`);
          w.postMessage(`go depth ${targetDepth}`);
        }, 100);
      }
      return true;
    },
    [histIdx, engineRunning, multiPV, targetDepth]
  );

  // ── Position history navigation ──────────────────────────────────────────
  const goTo = useCallback(
    (idx: number) => {
      const newIdx = Math.max(0, Math.min(idx, posHistory.length - 1));
      if (newIdx === histIdx) return;
      setHistIdx(newIdx);
      const targetFen = posHistory[newIdx];
      try {
        gameRef.current.load(targetFen);
      } catch {
        return;
      }
      setFen(targetFen);
      setArrows([]);
      setHighlights({});
    },
    [posHistory, histIdx]
  );

  // ── Square click: highlight squares ─────────────────────────────────────
  const onSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      setHighlights((prev) => {
        if (prev[square]) {
          const next = { ...prev };
          delete next[square];
          return next;
        }
        const color =
          arrowColor === "green"
            ? "rgba(0,180,0,0.45)"
            : arrowColor === "red"
              ? "rgba(200,30,30,0.45)"
              : arrowColor === "blue"
                ? "rgba(30,100,220,0.45)"
                : "rgba(200,180,0,0.55)";
        return { ...prev, [square]: { backgroundColor: color } };
      });
    },
    [arrowColor]
  );

  // ── Position actions ─────────────────────────────────────────────────────
  const resetGame = () => {
    stopAnalysis();
    gameRef.current.reset();
    const startFen = gameRef.current.fen();
    setFen(startFen);
    setPosHistory([startFen]);
    setHistIdx(0);
    setMoveList([]);
    setArrows([]);
    setHighlights({});
    setEngineLines([]);
    setEvalCp(0);
    setEvalMate(null);
  };

  const loadFen = () => {
    const trimmed = fenInput.trim();
    if (!trimmed) return;
    try {
      gameRef.current.load(trimmed);
    } catch {
      toast.error("Invalid FEN string");
      return;
    }
    const newFen = gameRef.current.fen();
    setFen(newFen);
    setPosHistory([newFen]);
    setHistIdx(0);
    setMoveList([]);
    setArrows([]);
    setHighlights({});
    setEngineLines([]);
    setShowFenDialog(false);
    toast.success("Position loaded");
  };

  const loadPgn = () => {
    const trimmed = pgnInput.trim();
    if (!trimmed) return;
    try {
      const g = new Chess();
      g.loadPgn(trimmed);
      gameRef.current = g;
      const history = g.history();

      // Reconstruct all positions
      const temp = new Chess();
      const fens = [temp.fen()];
      for (const san of history) {
        temp.move(san);
        fens.push(temp.fen());
      }

      const lastFen = g.fen();
      setFen(lastFen);
      setPosHistory(fens);
      setHistIdx(fens.length - 1);
      setMoveList(history);
      setArrows([]);
      setHighlights({});
      setEngineLines([]);
      setShowFenDialog(false);
      toast.success(`PGN loaded — ${history.length} moves`);
    } catch {
      toast.error("Invalid PGN");
    }
  };

  const loadIntoAnalysis = (pos: ScanPosition) => {
    let game: Chess | null = null;
    try {
      game = new Chess(pos.fen);
    } catch {
      game = null;
    }

    if (!game) {
      // The scan produced an illegal position (e.g. a missing/duplicate king or
      // a pawn on the back rank). Rather than blocking the user, show the
      // recognized pieces on an editable board so they can confirm or fix it,
      // then apply to analyze.
      setEditPos(fenToPosition(pos.fen));
      setEditSide((pos.fen.split(" ")[1] as "w" | "b") || "w");
      setSelectedPiece(null);
      setEditMode(true);
      setArrows([]);
      setHighlights({});
      setEngineLines([]);
      stopAnalysis();
      setActiveTab("analyze");
      toast.message("Position needs a fix", {
        description:
          "The scan wasn't a legal position. Adjust the pieces on the board, then tap \u201CDone Editing\u201D to analyze.",
      });
      return;
    }

    const newFen = game.fen();
    gameRef.current = game;
    setFen(newFen);
    setPosHistory([newFen]);
    setHistIdx(0);
    setMoveList([]);
    setArrows([]);
    setHighlights({});
    setEngineLines([]);
    setEditMode(false);
    setActiveTab("analyze");
    toast.success("Position loaded into analysis board");
  };

  // ── Edit mode ────────────────────────────────────────────────────────────
  const enterEditMode = useCallback(() => {
    stopAnalysis();
    setEditPos(fenToPosition(fen));
    setEditSide(fen.split(" ")[1] as "w" | "b");
    setSelectedPiece(null);
    setEditMode(true);
  }, [fen]);

  const exitEditMode = useCallback(() => {
    const newFen = positionToFen(editPos, editSide);
    try {
      gameRef.current.load(newFen);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      toast.error(`Invalid position: ${reason}`);
      return;
    }
    const validFen = gameRef.current.fen();
    setFen(validFen);
    setPosHistory([validFen]);
    setHistIdx(0);
    setMoveList([]);
    setArrows([]);
    setHighlights({});
    setEngineLines([]);
    setEvalCp(0);
    setEvalMate(null);
    setEditMode(false);
    setSelectedPiece(null);
    toast.success("Position set");
  }, [editPos, editSide]);

  const onEditSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (!editMode) return;
      setEditPos((prev) => {
        const next = { ...prev };
        if (selectedPiece) {
          if (next[square] === selectedPiece) {
            delete next[square];
          } else {
            next[square] = selectedPiece;
          }
        } else {
          delete next[square];
        }
        return next;
      });
    },
    [editMode, selectedPiece]
  );

  const onEditPieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (!editMode || !targetSquare) return false;
      if (sourceSquare === targetSquare) return false;
      setEditPos((prev) => {
        const next = { ...prev };
        const moving = next[sourceSquare] ?? (piece.pieceType as PieceCode);
        next[targetSquare] = moving;
        if (next[sourceSquare]) delete next[sourceSquare];
        return next;
      });
      return true;
    },
    [editMode]
  );

  // ── Scan: image ──────────────────────────────────────────────────────────
  // Single captures use the whole-image read first: the model sees the full
  // board with its own grid lines/coordinates and cross-checks several passes
  // square-by-square server-side, which is the most reliable path. The crop-
  // dependent per-square montage is kept only as a fallback if nothing is found.
  const scanImage = async (file: File) => {
    setIsScanning(true);
    setScanResults([]);
    try {
      let positions: ScanPosition[] = [];

      // Primary: whole-image read. The model sees the full board with its own
      // grid lines and coordinates, so piece localization is anchored by the
      // board itself — far more reliable than slicing a client-side crop into
      // 64 cells, where any imperfect crop shifts every square.
      try {
        const { base64, mimeType } = await downscaleImage(file);
        const resp = await fetch("/api/chess-eye/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        if (resp.ok) {
          const data = await resp.json();
          positions = data.positions ?? [];
        }
      } catch {
        // fall through to the per-square montage read
      }

      // Fallback: per-square montage read, used only when the whole-image read
      // returned nothing.
      if (positions.length === 0) {
        const montage = await buildBoardMontage(file).catch(() => null);
        if (montage) {
          const resp = await fetch("/api/chess-eye/scan-squares", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              montageBase64: montage.base64,
              mimeType: montage.mimeType,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            positions = data.positions ?? [];
          }
        }
      }

      setScanResults(positions);
      if (positions.length === 0) {
        toast.info(
          "No chess diagram detected. Try a clearer, straight-on photo of the board."
        );
      } else if (positions.length === 1) {
        // Single position → flow straight onto the analysis board for Stockfish
        loadIntoAnalysis(positions[0]);
      } else {
        toast.success(
          `Found ${positions.length} chess positions — pick one to analyze.`
        );
      }
    } catch {
      toast.error("Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  // ── Scan: PDF ────────────────────────────────────────────────────────────
  const scanPdf = async (file: File) => {
    setIsScanning(true);
    setScanResults([]);
    setPdfProgress(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, 50);
      const allResults: ScanPosition[] = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setPdfProgress({ current: pageNum, total: totalPages });
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;

        const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

        try {
          const resp = await fetch("/api/chess-eye/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: "image/jpeg",
              pageNumber: pageNum,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const positions = (data.positions ?? []).map(
              (p: ScanPosition) => ({
                ...p,
                notes: `Page ${pageNum}${p.notes ? " — " + p.notes : ""}`,
              })
            );
            allResults.push(...positions);
          }
        } catch {
          // continue to next page
        }
      }

      setScanResults(allResults);
      setPdfProgress(null);
      toast.success(
        `Scanned ${totalPages} page(s), found ${allResults.length} position(s)`
      );
    } catch {
      toast.error("Failed to process PDF.");
    } finally {
      setIsScanning(false);
      setPdfProgress(null);
    }
  };

  const handleScan = () => {
    if (!scanFile) return;
    if (scanFile.type === "application/pdf") {
      scanPdf(scanFile);
    } else {
      scanImage(scanFile);
    }
  };

  const handleFileSelect = (file: File) => {
    setScanResults([]);
    if (file.type === "application/pdf") {
      setScanFile(file);
      setPreviewUrl(null);
      return;
    }
    // Images go through the crop step first so only the board is scanned.
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(URL.createObjectURL(file));
    setShowCropDialog(true);
  };

  // Use the cropped image as the file to scan.
  const applyCrop = (blob: Blob) => {
    const file = new File([blob], `crop-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setScanFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setShowCropDialog(false);
    if (cropUrl) {
      URL.revokeObjectURL(cropUrl);
      setCropUrl(null);
    }
  };

  // Skip cropping — scan the whole image as-is.
  const cancelCrop = () => {
    setShowCropDialog(false);
    if (cropUrl) {
      URL.revokeObjectURL(cropUrl);
      setCropUrl(null);
    }
  };

  // Re-open the cropper for an already-selected image.
  const recropFile = () => {
    if (!scanFile || scanFile.type === "application/pdf") return;
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(URL.createObjectURL(scanFile));
    setShowCropDialog(true);
  };

  // ── Camera capture ─────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    setCameraStarting(false);
  }, [stopCamera]);

  const openCamera = useCallback(async () => {
    // Fallback to the native camera/file picker when getUserMedia is unavailable
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    // Stop any existing stream before requesting a new one
    stopCamera();
    setCameraOpen(true);
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      // Bind happens in an effect once the dialog (and <video>) has mounted
      setCameraStream(stream);
    } catch {
      // Permission denied or no live camera (common inside iframes) → native picker
      stopCamera();
      setCameraOpen(false);
      setCameraStarting(false);
      toast.info("Opening your device camera…");
      cameraInputRef.current?.click();
    }
  }, [stopCamera]);

  // Attach the stream to the <video> once both the stream and the dialog's
  // video element are available (the Dialog mounts the <video> asynchronously)
  useEffect(() => {
    if (!cameraOpen || !cameraStream) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = cameraStream;
    video.play().catch(() => {});
  }, [cameraOpen, cameraStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Camera is still starting — please wait a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to capture photo. Please try again.");
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        closeCamera();
        handleFileSelect(file);
        toast.success("Photo captured — crop to the board, then scan.");
      },
      "image/jpeg",
      0.92
    );
  }, [closeCamera]);

  // Release the camera if the component unmounts while it is open
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Score sheet → PGN ──────────────────────────────────────────────────────
  const handleScoresheetSelect = (file: File) => {
    if (ssPreviewUrl) URL.revokeObjectURL(ssPreviewUrl);
    setSsPreviewUrl(
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    );
    setSsFile(file);
    setSsScanned(false);
    setSsMoves([]);
    setSsConfidence(null);
    setSsNotes("");
  };

  const scanScoresheet = async (file: File) => {
    setSsScanning(true);
    try {
      // Handwriting needs more resolution than a board diagram, so allow a
      // higher downscale cap for this mode.
      const { base64, mimeType } = await downscaleImage(file, 2600);
      const resp = await fetch("/api/chess-eye/scan-scoresheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!resp.ok) throw new Error("scan failed");
      const data = await resp.json();
      setSsTags({
        event: data.tags?.event ?? "",
        site: data.tags?.site ?? "",
        date: data.tags?.date ?? "",
        round: data.tags?.round ?? "",
        white: data.tags?.white ?? "",
        black: data.tags?.black ?? "",
        result: data.tags?.result || "*",
      });
      setSsMoves(Array.isArray(data.moves) ? data.moves.map(String) : []);
      setSsConfidence(
        typeof data.confidence === "number" ? data.confidence : null
      );
      setSsNotes(typeof data.notes === "string" ? data.notes : "");
      setSsScanned(true);
      const cnt = Array.isArray(data.moves) ? data.moves.length : 0;
      toast.success(
        `Read ${cnt} move(s). Review the highlighted moves, then copy the PGN.`
      );
    } catch {
      toast.error(
        "Couldn't read the score sheet. Try a clearer, well-lit, straight-on photo."
      );
    } finally {
      setSsScanning(false);
    }
  };

  const updateSsMove = (i: number, val: string) =>
    setSsMoves((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });

  const removeSsMove = (i: number) =>
    setSsMoves((prev) => prev.filter((_, idx) => idx !== i));

  const addSsMove = () => setSsMoves((prev) => [...prev, ""]);

  // Live validation: replay the (editable) move list through chess.js, find the
  // first move that can't be played legally, and rebuild the PGN on every edit.
  const scoresheetGame = useMemo(() => {
    const chess = new Chess();
    let firstIllegal = -1;
    let legalCount = 0;
    for (let i = 0; i < ssMoves.length; i++) {
      const san = (ssMoves[i] ?? "").trim();
      if (!san) {
        firstIllegal = i;
        break;
      }
      try {
        chess.move(san);
        legalCount++;
      } catch {
        firstIllegal = i;
        break;
      }
    }
    chess.header(
      "Event",
      ssTags.event || "?",
      "Site",
      ssTags.site || "?",
      "Date",
      ssTags.date || "????.??.??",
      "Round",
      ssTags.round || "?",
      "White",
      ssTags.white || "?",
      "Black",
      ssTags.black || "?",
      "Result",
      ssTags.result || "*"
    );
    return {
      pgn: chess.pgn(),
      firstIllegal,
      legalCount,
      allLegal: firstIllegal === -1,
    };
  }, [ssMoves, ssTags]);

  // Board preview: position after `ssPly` legal moves.
  const ssBoardFen = useMemo(() => {
    const chess = new Chess();
    const n = Math.min(ssPly, scoresheetGame.legalCount);
    for (let i = 0; i < n; i++) {
      try {
        chess.move(ssMoves[i]);
      } catch {
        break;
      }
    }
    return chess.fen();
  }, [ssPly, ssMoves, scoresheetGame.legalCount]);

  // Jump the preview to the end of the legal line whenever it changes.
  useEffect(() => {
    setSsPly(scoresheetGame.legalCount);
  }, [scoresheetGame.legalCount]);

  const copyScoresheetPgn = () => {
    navigator.clipboard.writeText(scoresheetGame.pgn);
    toast.success("PGN copied to clipboard");
  };

  const downloadScoresheetPgn = () => {
    const safe = (s: string) =>
      (s || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    const w = safe(ssTags.white) || "White";
    const b = safe(ssTags.black) || "Black";
    const d = (ssTags.date || "").replace(/\./g, "-");
    const name = `${w}_vs_${b}${d ? "_" + d : ""}.pgn`;
    const blob = new Blob([scoresheetGame.pgn], {
      type: "application/x-chess-pgn",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PGN downloaded");
  };

  // ── Library ──────────────────────────────────────────────────────────────
  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const resp = await fetch("/api/chess-eye/positions");
      if (resp.ok) setSavedPositions(await resp.json());
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "library") loadLibrary();
  }, [activeTab]);

  const savePosition = async () => {
    if (!saveTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setIsSaving(true);
    try {
      const resp = await fetch("/api/chess-eye/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveTitle,
          fen,
          pgn: gameRef.current.pgn() || undefined,
          notes: saveNotes || undefined,
          engineEval: engineLines[0]?.eval ?? undefined,
        }),
      });
      if (!resp.ok) throw new Error();
      toast.success("Position saved to library");
      setShowSaveDialog(false);
      setSaveTitle("");
      setSaveNotes("");
      if (activeTab === "library") loadLibrary();
    } catch {
      toast.error("Failed to save position");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePosition = async (id: number) => {
    await fetch(`/api/chess-eye/positions/${id}`, { method: "DELETE" });
    setSavedPositions((prev) => prev.filter((p) => p.id !== id));
    toast.success("Position deleted");
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const whitePercent = evalToWhitePercent(evalCp, evalMate);

  const evalLabel = (() => {
    if (evalMate !== null)
      return evalMate > 0 ? `M${Math.abs(evalMate)}` : `-M${Math.abs(evalMate)}`;
    return evalCp >= 0
      ? `+${(evalCp / 100).toFixed(2)}`
      : `${(evalCp / 100).toFixed(2)}`;
  })();

  // Group moves for display
  const groupedMoves: {
    num: number;
    white: string;
    black?: string;
    wIdx: number;
    bIdx: number;
  }[] = [];
  for (let i = 0; i < moveList.length; i += 2) {
    groupedMoves.push({
      num: Math.floor(i / 2) + 1,
      white: moveList[i],
      black: moveList[i + 1],
      wIdx: i,
      bIdx: i + 1,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-background">
        <div className="container px-4 sm:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Chess Eye</h1>
              <p className="text-sm text-muted-foreground">
                Scan · Analyze · Learn
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 sm:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="analyze" className="gap-2">
              <Brain className="h-4 w-4" /> Analyze
            </TabsTrigger>
            <TabsTrigger value="scan" className="gap-2">
              <ScanLine className="h-4 w-4" /> Scan
            </TabsTrigger>
            <TabsTrigger value="scoresheet" className="gap-2">
              <FileText className="h-4 w-4" /> Score Sheet
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <BookMarked className="h-4 w-4" /> Library
            </TabsTrigger>
          </TabsList>

          {/* ══════════════ ANALYZE TAB ══════════════ */}
          <TabsContent value="analyze">
            <div className="flex flex-col gap-6 xl:flex-row">
              {/* Left: board area */}
              <div ref={boardContainerRef} className="flex flex-col gap-3 w-full xl:w-auto">
                {/* Edit mode piece palette */}
                {editMode && (
                  <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        ✏️ Edit Mode — click a piece then click a square to place it
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                        onClick={() => setEditPos({})}
                      >
                        Clear All
                      </Button>
                    </div>
                    {/* Piece palette: white row + black row */}
                    <div className="flex flex-wrap gap-1">
                      {PALETTE.map(({ code, sym, title }) => (
                        <button
                          key={code}
                          title={title}
                          onClick={() => setSelectedPiece((p) => (p === code ? null : code))}
                          className={`flex h-9 w-9 items-center justify-center rounded-md border-2 text-xl transition-all ${
                            selectedPiece === code
                              ? "border-amber-500 bg-amber-200 dark:bg-amber-800 scale-110 shadow-md"
                              : "border-border bg-white dark:bg-zinc-900 hover:border-amber-400 hover:scale-105"
                          } ${code.startsWith("b") ? "text-zinc-900 dark:text-zinc-100" : ""}`}
                          style={{ fontSize: "1.25rem", lineHeight: 1 }}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                    {/* Side to move toggle */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Side to move:</span>
                      <button
                        onClick={() => setEditSide("w")}
                        className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${editSide === "w" ? "bg-white text-zinc-900 border-zinc-400 shadow-sm" : "border-border text-muted-foreground hover:border-zinc-400"}`}
                      >
                        ♔ White
                      </button>
                      <button
                        onClick={() => setEditSide("b")}
                        className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${editSide === "b" ? "bg-zinc-900 text-white border-zinc-600 shadow-sm" : "border-border text-muted-foreground hover:border-zinc-400"}`}
                      >
                        ♚ Black
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  {/* Eval bar (hidden in edit mode) */}
                  {!editMode && (
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground min-h-[14px]">
                        {evalMate !== null && evalMate < 0
                          ? `-M${Math.abs(evalMate)}`
                          : evalCp < -20
                            ? `${(evalCp / 100).toFixed(1)}`
                            : ""}
                      </span>
                      <div
                        className="relative w-3 rounded bg-gray-900"
                        style={{ height: boardWidth }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-b bg-white transition-all duration-500"
                          style={{ height: `${whitePercent}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground min-h-[14px]">
                        {evalMate !== null && evalMate > 0
                          ? `M${Math.abs(evalMate)}`
                          : evalCp > 20
                            ? `+${(evalCp / 100).toFixed(1)}`
                            : ""}
                      </span>
                    </div>
                  )}

                  {/* Chessboard */}
                  <div style={{ width: boardWidth }}>
                    <Chessboard
                      options={{
                        id: "chess-eye-board",
                        position: editMode
                          ? boardPositionToV5(editPos)
                          : fen,
                        onPieceDrop: editMode ? onEditPieceDrop : onDrop,
                        onSquareClick: editMode
                          ? onEditSquareClick
                          : onSquareClick,
                        boardOrientation: boardFlipped ? "black" : "white",
                        arrows: editMode
                          ? []
                          : arrows.map(([startSquare, endSquare, color]) => ({
                              startSquare,
                              endSquare,
                              color,
                            })),
                        squareStyles: editMode ? {} : highlights,
                        animationDurationInMs: editMode ? 0 : 150,
                        darkSquareStyle: { backgroundColor: "#769656" },
                        lightSquareStyle: { backgroundColor: "#eeeed2" },
                        boardStyle: {
                          borderRadius: "6px",
                          boxShadow: editMode
                            ? "0 0 0 3px #f59e0b, 0 4px 20px rgba(0,0,0,0.15)"
                            : "0 4px 20px rgba(0,0,0,0.15)",
                        },
                        allowDragging: true,
                      }}
                    />
                  </div>
                </div>

                {/* Board controls row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {editMode ? (
                    <>
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white gap-1"
                        onClick={exitEditMode}
                      >
                        ✓ Done Editing
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditMode(false); setSelectedPiece(null); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBoardFlipped((f) => !f)}
                      >
                        <FlipHorizontal className="mr-1 h-3.5 w-3.5" /> Flip
                      </Button>
                    </>
                  ) : (
                    <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBoardFlipped((f) => !f)}
                  >
                    <FlipHorizontal className="mr-1 h-3.5 w-3.5" /> Flip
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetGame}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
                  </Button>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goTo(0)}
                      disabled={histIdx === 0}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goTo(histIdx - 1)}
                      disabled={histIdx === 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goTo(histIdx + 1)}
                      disabled={histIdx >= posHistory.length - 1}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goTo(posHistory.length - 1)}
                      disabled={histIdx >= posHistory.length - 1}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(fen);
                      toast.success("FEN copied");
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> FEN
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFenInput(fen);
                      setPgnInput("");
                      setShowFenDialog(true);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Load
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSaveTitle("");
                      setSaveNotes("");
                      setShowSaveDialog(true);
                    }}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={enterEditMode}
                    className="gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                    </>
                  )}
                </div>

                {/* Annotation color picker (hidden in edit mode) */}
                {!editMode && <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Highlight:
                  </span>
                  {(
                    [
                      { color: "green", bg: "#16a34a" },
                      { color: "red", bg: "#dc2626" },
                      { color: "blue", bg: "#2563eb" },
                      { color: "yellow", bg: "#ca8a04" },
                    ] as const
                  ).map(({ color, bg }) => (
                    <button
                      key={color}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${arrowColor === color ? "scale-125 border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: bg }}
                      onClick={() => setArrowColor(color)}
                    />
                  ))}
                  {Object.keys(highlights).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setHighlights({});
                        setArrows([]);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>}
              </div>

              {/* Right: engine + move history */}
              <div className="flex flex-1 flex-col gap-4 min-w-0">
                {/* Engine card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Stockfish 10
                        {!engineReady && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Loading…
                          </Badge>
                        )}
                        {engineReady && !engineRunning && (
                          <Badge variant="outline" className="text-xs">
                            Ready
                          </Badge>
                        )}
                        {engineRunning && (
                          <Badge className="bg-green-600 text-xs">
                            Depth {engineDepth}
                          </Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {engineRunning ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-3 text-xs"
                            onClick={stopAnalysis}
                          >
                            <StopIcon className="mr-1 h-3 w-3" /> Stop
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={startAnalysis}
                            disabled={!engineReady}
                          >
                            <Play className="mr-1 h-3 w-3" /> Analyze
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Engine settings */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Depth:</span>
                        <Select
                          value={targetDepth.toString()}
                          onValueChange={(v) => setTargetDepth(parseInt(v))}
                        >
                          <SelectTrigger className="h-6 w-16 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[10, 15, 18, 20, 22, 25].map((d) => (
                              <SelectItem key={d} value={d.toString()}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Lines:</span>
                        <Select
                          value={multiPV.toString()}
                          onValueChange={(v) => setMultiPV(parseInt(v))}
                        >
                          <SelectTrigger className="h-6 w-16 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {engineLines.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Eval:</span>
                          <span
                            className={`font-mono font-semibold ${
                              evalMate !== null
                                ? evalMate > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                                : evalCp >= 0
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-red-600"
                            }`}
                          >
                            {evalLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Engine lines */}
                    <div className="space-y-2">
                      {engineLines.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          {engineReady
                            ? "Press Analyze to start engine analysis"
                            : "Loading Stockfish chess engine…"}
                        </p>
                      ) : (
                        engineLines.map((line, i) => (
                          <div
                            key={i}
                            className="rounded-md bg-muted/40 px-3 py-2"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`font-mono text-sm font-bold ${
                                  line.mate !== null
                                    ? line.mate > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                    : line.eval >= 0
                                      ? "text-green-700 dark:text-green-400"
                                      : "text-red-600"
                                }`}
                              >
                                {line.mate !== null
                                  ? line.mate > 0
                                    ? `M${Math.abs(line.mate)}`
                                    : `-M${Math.abs(line.mate)}`
                                  : line.eval >= 0
                                    ? `+${(line.eval / 100).toFixed(2)}`
                                    : `${(line.eval / 100).toFixed(2)}`}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                d{line.depth}
                              </span>
                            </div>
                            <p className="font-mono text-xs leading-relaxed text-foreground/80">
                              {line.san.slice(0, 8).join(" ")}
                              {line.san.length > 8 && "…"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Move history */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Move History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {moveList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Make moves on the board to see them here
                      </p>
                    ) : (
                      <div className="flex max-h-48 flex-wrap gap-x-1 gap-y-0.5 overflow-y-auto">
                        {groupedMoves.map(({ num, white, black, wIdx, bIdx }) => (
                          <span
                            key={num}
                            className="flex items-center gap-0.5"
                          >
                            <span className="text-xs text-muted-foreground">
                              {num}.
                            </span>
                            <button
                              className={`rounded px-1 py-0.5 font-mono text-xs hover:bg-muted ${wIdx + 1 === histIdx ? "bg-primary/20 text-primary font-semibold" : ""}`}
                              onClick={() => goTo(wIdx + 1)}
                            >
                              {white}
                            </button>
                            {black && (
                              <button
                                className={`rounded px-1 py-0.5 font-mono text-xs hover:bg-muted ${bIdx + 1 === histIdx ? "bg-primary/20 text-primary font-semibold" : ""}`}
                                onClick={() => goTo(bIdx + 1)}
                              >
                                {black}
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick tips */}
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground/70">Tips</p>
                  <p>• Drag pieces to make moves on the board</p>
                  <p>• Click squares to highlight them</p>
                  <p>• Use Load to enter any FEN or PGN position</p>
                  <p>• Use Scan tab to recognize positions from photos or PDFs</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════ SCAN TAB ══════════════ */}
          <TabsContent value="scan">
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Scan Chess Position</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Take a photo with your camera, upload a chess diagram image, or
                  scan a PDF chess book. Crop to just the board for sharper
                  results — our Gemini AI recognizes the position and loads it
                  onto the analysis board for Stockfish.
                </p>
              </div>

              {/* Dropzone */}
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = "";
                  }}
                />
                <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-sm mb-1">
                  Drop a chess diagram here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG · PNG · WEBP · PDF (up to 50 pages)
                </p>
              </div>

              {/* Camera capture */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={openCamera}
              >
                <Camera className="h-4 w-4" /> Take Photo with Camera
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />

              {/* Live camera dialog */}
              <Dialog
                open={cameraOpen}
                onOpenChange={(o) => {
                  if (!o) closeCamera();
                }}
              >
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Capture Chess Diagram</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={() => setCameraStarting(false)}
                        className="h-auto w-full"
                      />
                      {cameraStarting && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Point your camera straight at the chess diagram, then tap
                      Capture.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={closeCamera}>
                        Cancel
                      </Button>
                      <Button
                        className="gap-2"
                        onClick={capturePhoto}
                        disabled={cameraStarting}
                      >
                        <Camera className="h-4 w-4" /> Capture
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Crop-before-scan dialog */}
              <Dialog
                open={showCropDialog}
                onOpenChange={(o) => {
                  if (!o) cancelCrop();
                }}
              >
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Crop &amp; straighten the board</DialogTitle>
                  </DialogHeader>
                  {cropUrl && (
                    <ImageCropper
                      imageUrl={cropUrl}
                      onCrop={applyCrop}
                      onCancel={cancelCrop}
                    />
                  )}
                </DialogContent>
              </Dialog>

              {/* Preview + scan controls */}
              {scanFile && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-64 max-w-xs rounded-lg border border-border object-contain"
                      />
                    )}
                    {scanFile.type === "application/pdf" && (
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        <BookOpen className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{scanFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(scanFile.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {!scanFile.type.startsWith("application") && (
                        <p className="text-sm font-medium">{scanFile.name}</p>
                      )}
                      <Button
                        onClick={handleScan}
                        disabled={isScanning}
                        className="gap-2"
                      >
                        {isScanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ScanLine className="h-4 w-4" />
                        )}
                        {isScanning
                          ? pdfProgress
                            ? `Page ${pdfProgress.current}/${pdfProgress.total}…`
                            : "Scanning…"
                          : "Scan with AI"}
                      </Button>
                      {!scanFile.type.startsWith("application") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={recropFile}
                          disabled={isScanning}
                        >
                          <Crop className="h-4 w-4" /> Adjust crop
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setScanFile(null);
                          setPreviewUrl(null);
                          setScanResults([]);
                        }}
                      >
                        Remove file
                      </Button>
                    </div>
                  </div>

                  {pdfProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing pages…</span>
                        <span>
                          {pdfProgress.current} / {pdfProgress.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${(pdfProgress.current / pdfProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scan results */}
              {scanResults.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold">
                    {scanResults.length} Position(s) Found
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Compare each board below against your photo. If a piece is
                    off, open <span className="font-medium">Analyze</span> and
                    use Edit mode to fix it before analyzing.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {scanResults.map((pos, i) => (
                      <Card key={i} className="border-border">
                        <CardContent className="space-y-3 p-4">
                          <div className="grid grid-cols-[7rem_1fr] gap-3">
                            <div className="w-28 shrink-0">
                              <Chessboard
                                options={{
                                  id: `scan-result-${i}`,
                                  position: pos.fen,
                                  boardOrientation: "white",
                                  allowDragging: false,
                                  darkSquareStyle: {
                                    backgroundColor: "#769656",
                                  },
                                  lightSquareStyle: {
                                    backgroundColor: "#eeeed2",
                                  },
                                  squareStyles: Object.fromEntries(
                                    (pos.lowConfidenceSquares ?? []).map(
                                      (sq) => [
                                        sq,
                                        {
                                          boxShadow:
                                            "inset 0 0 0 3px rgba(245,158,11,0.9)",
                                        },
                                      ]
                                    )
                                  ),
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-medium">
                                  {pos.sideToMove === "black"
                                    ? "Black to move"
                                    : "White to move"}
                                </span>
                                <Badge
                                  variant={
                                    pos.confidence >= 80
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="shrink-0 text-xs"
                                >
                                  {pos.confidence}%
                                </Badge>
                              </div>
                              <p className="mt-1 break-all font-mono text-[10px] leading-tight text-muted-foreground">
                                {pos.fen}
                              </p>
                              {pos.notes && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {pos.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          {pos.lowConfidenceSquares &&
                          pos.lowConfidenceSquares.length > 0 ? (
                            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              Double-check{" "}
                              {pos.lowConfidenceSquares.length > 8
                                ? `${pos.lowConfidenceSquares.length} squares`
                                : pos.lowConfidenceSquares.join(", ")}{" "}
                              (highlighted) — the scan passes disagreed there.
                              Fix in Edit mode if needed.
                            </p>
                          ) : (
                            pos.confidence < 80 && (
                              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                                Low confidence — the scan passes disagreed.
                                Please double-check this position against your
                                photo.
                              </p>
                            )
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => loadIntoAnalysis(pos)}
                            >
                              <ArrowRight className="h-3 w-3" /> Analyze
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(pos.fen);
                                toast.success("FEN copied");
                              }}
                            >
                              <Copy className="h-3 w-3" /> FEN
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══════════════ SCORE SHEET TAB ══════════════ */}
          <TabsContent value="scoresheet">
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Score Sheet → PGN
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Photograph or upload a handwritten chess score sheet. Our
                  Gemini AI reads the header fields and moves, validates every
                  move with the chess engine, and builds a PGN you can review,
                  fix, copy and download.
                </p>
              </div>

              {/* Dropzone */}
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={() => ssFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleScoresheetSelect(file);
                }}
              >
                <input
                  ref={ssFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleScoresheetSelect(file);
                    e.target.value = "";
                  }}
                />
                <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-sm mb-1">
                  Drop a score sheet photo here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG · PNG · WEBP — a flat, well-lit, straight-on
                  photo reads best
                </p>
              </div>

              {/* Camera capture (native picker) */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => ssCameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Take Photo with Camera
              </Button>
              <input
                ref={ssCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleScoresheetSelect(file);
                  e.target.value = "";
                }}
              />

              {/* Preview + scan control */}
              {ssFile && !ssScanned && (
                <div className="flex flex-wrap items-start gap-4">
                  {ssPreviewUrl && (
                    <img
                      src={ssPreviewUrl}
                      alt="Score sheet preview"
                      className="max-h-72 max-w-sm rounded-lg border border-border object-contain"
                    />
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{ssFile.name}</p>
                    <Button
                      onClick={() => scanScoresheet(ssFile)}
                      disabled={ssScanning}
                      className="gap-2"
                    >
                      {ssScanning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScanLine className="h-4 w-4" />
                      )}
                      {ssScanning ? "Reading…" : "Read Score Sheet"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (ssPreviewUrl) URL.revokeObjectURL(ssPreviewUrl);
                        setSsFile(null);
                        setSsPreviewUrl(null);
                      }}
                    >
                      Remove file
                    </Button>
                  </div>
                </div>
              )}

              {/* Review + edit */}
              {ssScanned && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Review &amp; fix</h3>
                    <div className="flex items-center gap-2">
                      {ssConfidence !== null && (
                        <Badge
                          variant={
                            ssConfidence >= 80 ? "default" : "secondary"
                          }
                        >
                          {ssConfidence}% confidence
                        </Badge>
                      )}
                      <Badge
                        variant={
                          scoresheetGame.allLegal ? "default" : "secondary"
                        }
                      >
                        {scoresheetGame.legalCount} legal move(s)
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (ssPreviewUrl) URL.revokeObjectURL(ssPreviewUrl);
                          setSsFile(null);
                          setSsPreviewUrl(null);
                          setSsScanned(false);
                          setSsMoves([]);
                        }}
                      >
                        Start over
                      </Button>
                    </div>
                  </div>

                  {!scoresheetGame.allLegal && ssMoves.length > 0 && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      Move{" "}
                      {Math.floor(scoresheetGame.firstIllegal / 2) + 1}
                      {scoresheetGame.firstIllegal % 2 === 0 ? "." : "…"} could
                      not be played legally — the highlighted moves below need
                      checking against your sheet. Only the legal moves before it
                      are included in the PGN.
                    </p>
                  )}

                  <div className="flex flex-col gap-6 lg:flex-row">
                    {/* Left: headers + moves */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {(
                          [
                            ["event", "Event"],
                            ["site", "Site"],
                            ["date", "Date"],
                            ["round", "Round"],
                            ["white", "White"],
                            ["black", "Black"],
                            ["result", "Result"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              value={ssTags[key]}
                              placeholder={
                                key === "date" ? "YYYY.MM.DD" : undefined
                              }
                              onChange={(e) =>
                                setSsTags((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-xs">Moves</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={addSsMove}
                          >
                            <Plus className="h-3 w-3" /> Add move
                          </Button>
                        </div>
                        {ssMoves.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No moves were read. Add moves manually or try a
                            clearer photo.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {ssMoves.map((m, i) => {
                              const isIssue =
                                scoresheetGame.firstIllegal >= 0 &&
                                i >= scoresheetGame.firstIllegal;
                              return (
                                <div
                                  key={i}
                                  className={`flex items-center gap-1 rounded-md border px-2 py-1 ${
                                    isIssue
                                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                                      : "border-border"
                                  }`}
                                >
                                  <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {Math.floor(i / 2) + 1}
                                    {i % 2 === 0 ? "." : "…"}
                                  </span>
                                  <Input
                                    value={m}
                                    onChange={(e) =>
                                      updateSsMove(i, e.target.value)
                                    }
                                    className="h-7 flex-1 px-1 font-mono text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSsMove(i)}
                                    className="shrink-0 text-muted-foreground hover:text-red-600"
                                    aria-label="Remove move"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {ssNotes && (
                        <p className="text-xs text-muted-foreground">
                          AI notes: {ssNotes}
                        </p>
                      )}
                    </div>

                    {/* Right: board preview */}
                    <div className="w-full shrink-0 space-y-2 lg:w-72">
                      <Label className="text-xs">Board preview</Label>
                      <Chessboard
                        options={{
                          id: "scoresheet-preview",
                          position: ssBoardFen,
                          boardOrientation: "white",
                          allowDragging: false,
                          darkSquareStyle: { backgroundColor: "#769656" },
                          lightSquareStyle: { backgroundColor: "#eeeed2" },
                        }}
                      />
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSsPly(0)}
                          disabled={ssPly <= 0}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSsPly((p) => Math.max(0, p - 1))}
                          disabled={ssPly <= 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
                          {ssPly} / {scoresheetGame.legalCount}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            setSsPly((p) =>
                              Math.min(scoresheetGame.legalCount, p + 1)
                            )
                          }
                          disabled={ssPly >= scoresheetGame.legalCount}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSsPly(scoresheetGame.legalCount)}
                          disabled={ssPly >= scoresheetGame.legalCount}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* PGN output */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">PGN</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={copyScoresheetPgn}
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={downloadScoresheetPgn}
                        >
                          <Download className="h-3 w-3" /> Download .pgn
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      readOnly
                      value={scoresheetGame.pgn}
                      className="h-40 font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══════════════ LIBRARY TAB ══════════════ */}
          <TabsContent value="library">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    My Chess Eye Library
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Saved positions and analysis sessions
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setActiveTab("analyze")}
                >
                  <Plus className="h-4 w-4" /> New Analysis
                </Button>
              </div>

              {libraryLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : savedPositions.length === 0 ? (
                <div className="py-12 text-center">
                  <BookMarked className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    No saved positions yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    Analyze a position and click Save to add it here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {savedPositions.map((pos) => (
                    <Card
                      key={pos.id}
                      className="border-border transition-colors hover:border-primary/50"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium leading-tight">
                            {pos.title}
                          </h3>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(pos.createdAt).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "2-digit" }
                            )}
                          </span>
                        </div>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {pos.fen.slice(0, 55)}…
                        </p>
                        {pos.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {pos.notes}
                          </p>
                        )}
                        {pos.engineEval !== undefined &&
                          pos.engineEval !== null && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-mono ${pos.engineEval >= 0 ? "text-green-700" : "text-red-600"}`}
                            >
                              {pos.engineEval >= 0
                                ? `+${(pos.engineEval / 100).toFixed(2)}`
                                : `${(pos.engineEval / 100).toFixed(2)}`}
                            </Badge>
                          )}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 gap-1 text-xs"
                            onClick={() =>
                              loadIntoAnalysis({
                                fen: pos.fen,
                                confidence: 100,
                                sideToMove: "white",
                              })
                            }
                          >
                            <Brain className="h-3 w-3" /> Analyze
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => deletePosition(pos.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Load FEN / PGN Dialog ── */}
      <Dialog open={showFenDialog} onOpenChange={setShowFenDialog}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Load Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>FEN String</Label>
              <Textarea
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                className="font-mono text-xs"
                rows={3}
              />
              <Button onClick={loadFen} className="w-full">
                Load FEN
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>PGN</Label>
              <Textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5..."
                className="font-mono text-xs"
                rows={4}
              />
              <Button variant="outline" onClick={loadPgn} className="w-full">
                Load PGN
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Save Position Dialog ── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Save Position to Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="e.g. Sicilian Dragon — Key Position"
                onKeyDown={(e) => e.key === "Enter" && savePosition()}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="Analysis notes, ideas, themes…"
                rows={3}
              />
            </div>
            <div className="rounded bg-muted/40 px-3 py-2">
              <p className="break-all font-mono text-xs text-muted-foreground">
                {fen}
              </p>
            </div>
            <Button
              onClick={savePosition}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save to Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
