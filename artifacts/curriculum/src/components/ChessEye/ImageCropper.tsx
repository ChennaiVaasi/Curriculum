import React, { useCallback, useEffect, useRef, useState } from "react";
import { Crop, RotateCcw, Frame } from "lucide-react";

type Handle = "nw" | "ne" | "sw" | "se" | "move";
type QuadCorner = "tl" | "tr" | "br" | "bl";
type Mode = "crop" | "straighten";

interface Rect { x: number; y: number; w: number; h: number; }
interface Point { x: number; y: number; }
type Quad = Record<QuadCorner, Point>;

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  busy?: boolean;
}

const MIN_SIZE = 32;

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

function computeHomography(dst: Point[], src: Point[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i];
    const { x, y } = src[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  return solveLinearSystem(A, b);
}

function perspectiveWarp(img: HTMLImageElement, srcPts: Point[], outSize: number): HTMLCanvasElement | null {
  const minX = Math.max(0, Math.floor(Math.min(...srcPts.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...srcPts.map((p) => p.y))));
  const maxX = Math.min(img.naturalWidth, Math.ceil(Math.max(...srcPts.map((p) => p.x))));
  const maxY = Math.min(img.naturalHeight, Math.ceil(Math.max(...srcPts.map((p) => p.y))));
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = bw;
  srcCanvas.height = bh;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return null;
  srcCtx.drawImage(img, minX, minY, bw, bh, 0, 0, bw, bh);
  const srcData = srcCtx.getImageData(0, 0, bw, bh);
  const sp = srcData.data;

  const adj = srcPts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  const N = outSize;
  const dstPts: Point[] = [{ x: 0, y: 0 }, { x: N, y: 0 }, { x: N, y: N }, { x: 0, y: N }];
  const H = computeHomography(dstPts, adj);
  if (!H) return null;
  const [a, b, c, d, e, f, g, h] = H;

  const out = document.createElement("canvas");
  out.width = N;
  out.height = N;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  const outData = outCtx.createImageData(N, N);
  const op = outData.data;

  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      const den = g * u + h * v + 1;
      const sx = (a * u + b * v + c) / den;
      const sy = (d * u + e * v + f) / den;
      const oi = (v * N + u) * 4;
      if (sx < 0 || sy < 0 || sx >= bw - 1 || sy >= bh - 1) {
        op[oi] = 0; op[oi + 1] = 0; op[oi + 2] = 0; op[oi + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * bw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + bw * 4;
      const i11 = i01 + 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = sp[i00 + ch] * (1 - fx) + sp[i10 + ch] * fx;
        const bot = sp[i01 + ch] * (1 - fx) + sp[i11 + ch] * fx;
        op[oi + ch] = top * (1 - fy) + bot * fy;
      }
      op[oi + 3] = 255;
    }
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}

function detectBoardFrac(img: HTMLImageElement): Rect | null {
  const nW = img.naturalWidth;
  const nH = img.naturalHeight;
  if (!nW || !nH) return null;
  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(nW, nH));
  const w = Math.max(8, Math.round(nW * scale));
  const h = Math.max(8, Math.round(nH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let pixels: Uint8ClampedArray;
  try { pixels = ctx.getImageData(0, 0, w, h).data; } catch { return null; }

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }

  const mag = new Float32Array(w * h);
  const colE = new Float32Array(w);
  const rowE = new Float32Array(h);
  let total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = gray[y * w + x + 1] - gray[y * w + x - 1];
      const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
      const m = Math.abs(gx) + Math.abs(gy);
      mag[y * w + x] = m;
      colE[x] += m; rowE[y] += m; total += m;
    }
  }
  if (total <= 0) return null;

  const trim = (profile: Float32Array, frac: number): [number, number] => {
    let sum = 0;
    for (let i = 0; i < profile.length; i++) sum += profile[i];
    const target = sum * frac;
    let acc = 0; let lo = 0;
    for (let i = 0; i < profile.length; i++) { acc += profile[i]; if (acc >= target) { lo = i; break; } }
    acc = 0; let hi = profile.length - 1;
    for (let i = profile.length - 1; i >= 0; i--) { acc += profile[i]; if (acc >= target) { hi = i; break; } }
    return [lo, Math.max(lo, hi)];
  };

  const TRIM = 0.05;
  const [x0, x1] = trim(colE, TRIM);
  const [y0, y1] = trim(rowE, TRIM);
  const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
  if (bw < w * 0.15 || bh < h * 0.15) return null;

  let inside = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) inside += mag[y * w + x];
  const density = (inside / (bw * bh)) / (total / (w * h));
  if (density < 1.25) return null;

  const padX = bw * 0.03; const padY = bh * 0.03;
  return {
    x: Math.max(0, (x0 - padX) / w),
    y: Math.max(0, (y0 - padY) / h),
    w: Math.min(1, (x1 + 1 + padX) / w) - Math.max(0, (x0 - padX) / w),
    h: Math.min(1, (y1 + 1 + padY) / h) - Math.max(0, (y0 - padY) / h),
  };
}

export default function ImageCropper({ imageUrl, onCrop, onCancel, busy = false }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("crop");
  const [working, setWorking] = useState(false);
  const [imgBox, setImgBox] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const boardFracRef = useRef<Rect | null>(null);
  const [autoFramed, setAutoFramed] = useState(false);

  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startRect: Rect } | null>(null);
  const quadDragRef = useRef<{ corner: QuadCorner; startX: number; startY: number; startPt: Point } | null>(null);

  const measure = useCallback((reset: boolean) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const box: Rect = { x: iRect.left - cRect.left, y: iRect.top - cRect.top, w: iRect.width, h: iRect.height };
    setImgBox(box);

    if (reset) boardFracRef.current = detectBoardFrac(img);
    const frac = boardFracRef.current;
    setAutoFramed(!!frac);

    setCrop((prev) => {
      if (!reset && prev) return prev;
      if (frac) return { x: box.x + frac.x * box.w, y: box.y + frac.y * box.h, w: frac.w * box.w, h: frac.h * box.h };
      const size = Math.min(box.w, box.h) * 0.8;
      return { x: box.x + (box.w - size) / 2, y: box.y + (box.h - size) / 2, w: size, h: size };
    });
    setQuad((prev) => {
      if (!reset && prev) return prev;
      if (frac) {
        const lx = box.x + frac.x * box.w; const ty = box.y + frac.y * box.h;
        const rx = box.x + (frac.x + frac.w) * box.w; const by = box.y + (frac.y + frac.h) * box.h;
        return { tl: { x: lx, y: ty }, tr: { x: rx, y: ty }, br: { x: rx, y: by }, bl: { x: lx, y: by } };
      }
      const ix = box.w * 0.15; const iy = box.h * 0.15;
      return {
        tl: { x: box.x + ix, y: box.y + iy }, tr: { x: box.x + box.w - ix, y: box.y + iy },
        br: { x: box.x + box.w - ix, y: box.y + box.h - iy }, bl: { x: box.x + ix, y: box.y + box.h - iy },
      };
    });
  }, []);

  useEffect(() => {
    const onResize = () => measure(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  const clampToImage = useCallback((r: Rect): Rect => {
    const minX = imgBox.x; const minY = imgBox.y;
    const maxX = imgBox.x + imgBox.w; const maxY = imgBox.y + imgBox.h;
    let { x, y, w, h } = r;
    w = Math.max(MIN_SIZE, Math.min(w, imgBox.w));
    h = Math.max(MIN_SIZE, Math.min(h, imgBox.h));
    x = Math.max(minX, Math.min(x, maxX - w));
    y = Math.max(minY, Math.min(y, maxY - h));
    return { x, y, w, h };
  }, [imgBox]);

  const clampPoint = useCallback((p: Point): Point => ({
    x: Math.max(imgBox.x, Math.min(p.x, imgBox.x + imgBox.w)),
    y: Math.max(imgBox.y, Math.min(p.y, imgBox.y + imgBox.h)),
  }), [imgBox]);

  const onCropPointerDown = useCallback((handle: Handle) => (e: React.PointerEvent) => {
    if (!crop) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startRect: { ...crop } };
  }, [crop]);

  const onQuadPointerDown = useCallback((corner: QuadCorner) => (e: React.PointerEvent) => {
    if (!quad) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    quadDragRef.current = { corner, startX: e.clientX, startY: e.clientY, startPt: { ...quad[corner] } };
  }, [quad]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const qDrag = quadDragRef.current;
      if (qDrag) {
        const dx = e.clientX - qDrag.startX; const dy = e.clientY - qDrag.startY;
        setQuad((prev) => prev ? { ...prev, [qDrag.corner]: clampPoint({ x: qDrag.startPt.x + dx, y: qDrag.startPt.y + dy }) } : prev);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX; const dy = e.clientY - drag.startY;
      const s = drag.startRect;
      let next: Rect;
      if (drag.handle === "move") {
        next = { ...s, x: s.x + dx, y: s.y + dy };
      } else {
        let { x, y, w, h } = s;
        if (drag.handle === "nw") { x = s.x + dx; y = s.y + dy; w = s.w - dx; h = s.h - dy; }
        else if (drag.handle === "ne") { y = s.y + dy; w = s.w + dx; h = s.h - dy; }
        else if (drag.handle === "sw") { x = s.x + dx; w = s.w - dx; h = s.h + dy; }
        else if (drag.handle === "se") { w = s.w + dx; h = s.h + dy; }
        if (w < MIN_SIZE) { w = MIN_SIZE; if (drag.handle === "nw" || drag.handle === "sw") x = s.x + s.w - MIN_SIZE; }
        if (h < MIN_SIZE) { h = MIN_SIZE; if (drag.handle === "nw" || drag.handle === "ne") y = s.y + s.h - MIN_SIZE; }
        next = { x, y, w, h };
      }
      setCrop(clampToImage(next));
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current || quadDragRef.current) (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      dragRef.current = null; quadDragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clampToImage, clampPoint]);

  const doCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img || !crop || imgBox.w === 0) return;
    const scaleX = img.naturalWidth / imgBox.w;
    const scaleY = img.naturalHeight / imgBox.h;
    const sx = Math.round((crop.x - imgBox.x) * scaleX);
    const sy = Math.round((crop.y - imgBox.y) * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, sw); canvas.height = Math.max(1, sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob((blob) => { if (blob) onCrop(blob); }, "image/jpeg", 0.95);
  }, [crop, imgBox, onCrop]);

  const doStraighten = useCallback(() => {
    const img = imgRef.current;
    if (!img || !quad || imgBox.w === 0) return;
    setWorking(true);
    requestAnimationFrame(() => {
      try {
        const scaleX = img.naturalWidth / imgBox.w;
        const scaleY = img.naturalHeight / imgBox.h;
        const toNatural = (p: Point): Point => ({ x: (p.x - imgBox.x) * scaleX, y: (p.y - imgBox.y) * scaleY });
        const srcPts = [quad.tl, quad.tr, quad.br, quad.bl].map(toNatural);
        const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
        const avgEdge = (dist(srcPts[0], srcPts[1]) + dist(srcPts[1], srcPts[2]) + dist(srcPts[2], srcPts[3]) + dist(srcPts[3], srcPts[0])) / 4;
        const outSize = Math.round(Math.max(256, Math.min(900, avgEdge)));
        const canvas = perspectiveWarp(img, srcPts, outSize);
        if (!canvas) { setWorking(false); return; }
        canvas.toBlob((blob) => { setWorking(false); if (blob) onCrop(blob); }, "image/jpeg", 0.95);
      } catch { setWorking(false); }
    });
  }, [quad, imgBox, onCrop]);

  const handleStyle = "absolute h-4 w-4 rounded-full border-2 border-white bg-stone-900 shadow touch-none";
  const isBusy = busy || working;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMode("crop")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${mode === "crop" ? "bg-stone-900 text-white" : "border border-stone-300 text-stone-700 hover:bg-stone-100"}`}
        >
          <Crop className="h-3.5 w-3.5" /> Crop
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMode("straighten")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${mode === "straighten" ? "bg-stone-900 text-white" : "border border-stone-300 text-stone-700 hover:bg-stone-100"}`}
        >
          <Frame className="h-3.5 w-3.5" /> Straighten
        </button>
      </div>

      {autoFramed && (
        <p className="text-center text-xs text-stone-500">Board detected automatically — adjust if needed.</p>
      )}

      <div ref={containerRef} className="relative mx-auto flex max-h-[60vh] w-full select-none items-center justify-center overflow-hidden rounded-lg bg-black/90">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Crop preview"
          draggable={false}
          onLoad={() => measure(true)}
          className="max-h-[60vh] w-auto max-w-full object-contain"
        />

        {mode === "crop" && crop && (
          <>
            <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${crop.y}px, ${crop.x}px ${crop.y}px, ${crop.x}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y}px, 0 ${crop.y}px)` }} />
            <div onPointerDown={onCropPointerDown("move")} className="absolute cursor-move border-2 border-white shadow touch-none" style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}>
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/25" />)}
              </div>
            </div>
            <div onPointerDown={onCropPointerDown("nw")} className={`${handleStyle} cursor-nwse-resize`} style={{ left: crop.x - 8, top: crop.y - 8 }} />
            <div onPointerDown={onCropPointerDown("ne")} className={`${handleStyle} cursor-nesw-resize`} style={{ left: crop.x + crop.w - 8, top: crop.y - 8 }} />
            <div onPointerDown={onCropPointerDown("sw")} className={`${handleStyle} cursor-nesw-resize`} style={{ left: crop.x - 8, top: crop.y + crop.h - 8 }} />
            <div onPointerDown={onCropPointerDown("se")} className={`${handleStyle} cursor-nwse-resize`} style={{ left: crop.x + crop.w - 8, top: crop.y + crop.h - 8 }} />
          </>
        )}

        {mode === "straighten" && quad && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
              <polygon
                points={[quad.tl, quad.tr, quad.br, quad.bl].map((p) => `${p.x},${p.y}`).join(" ")}
                fill="rgba(0,0,0,0.45)"
                stroke="white"
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            </svg>
            {(["tl", "tr", "br", "bl"] as QuadCorner[]).map((corner) => (
              <div
                key={corner}
                onPointerDown={onQuadPointerDown(corner)}
                className={`${handleStyle} cursor-move`}
                style={{ left: quad[corner].x - 8, top: quad[corner].y - 8 }}
              />
            ))}
          </>
        )}

        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
        >
          Skip crop
        </button>
        {mode === "crop" ? (
          <button
            type="button"
            onClick={doCrop}
            disabled={isBusy || !crop}
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            <Crop className="mr-1.5 inline h-3.5 w-3.5" /> Apply Crop
          </button>
        ) : (
          <button
            type="button"
            onClick={doStraighten}
            disabled={isBusy || !quad}
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            <RotateCcw className="mr-1.5 inline h-3.5 w-3.5" /> Straighten &amp; Crop
          </button>
        )}
      </div>
    </div>
  );
}
