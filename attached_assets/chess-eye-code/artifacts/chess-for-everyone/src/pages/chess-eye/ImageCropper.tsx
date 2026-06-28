import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Crop, RotateCcw, Frame } from "lucide-react";

type Handle = "nw" | "ne" | "sw" | "se" | "move";
type QuadCorner = "tl" | "tr" | "br" | "bl";
type Mode = "crop" | "straighten";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

type Quad = Record<QuadCorner, Point>;

interface ImageCropperProps {
  imageUrl: string;
  /** Called with the corrected JPEG blob when the user confirms. */
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  busy?: boolean;
}

const MIN_SIZE = 32; // minimum crop size in displayed pixels

// ── Perspective-warp math ────────────────────────────────────────────────────

/** Solve an n×n linear system (Gaussian elimination with partial pivoting). */
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

/**
 * Compute the homography (8 coefficients) mapping `dst` points to `src` points,
 * so each output pixel (u,v) can be inverse-mapped to a source coordinate.
 */
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

/**
 * Warp the quadrilateral defined by `srcPts` (in natural image coordinates,
 * order tl, tr, br, bl) into a square `outSize`×`outSize` canvas using inverse
 * homography sampling with bilinear interpolation.
 */
function perspectiveWarp(
  img: HTMLImageElement,
  srcPts: Point[],
  outSize: number,
): HTMLCanvasElement | null {
  const minX = Math.max(0, Math.floor(Math.min(...srcPts.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...srcPts.map((p) => p.y))));
  const maxX = Math.min(
    img.naturalWidth,
    Math.ceil(Math.max(...srcPts.map((p) => p.x))),
  );
  const maxY = Math.min(
    img.naturalHeight,
    Math.ceil(Math.max(...srcPts.map((p) => p.y))),
  );
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);

  // Draw only the quad's bounding box to keep memory/ImageData small.
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
  const dstPts: Point[] = [
    { x: 0, y: 0 },
    { x: N, y: 0 },
    { x: N, y: N },
    { x: 0, y: N },
  ];
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
        op[oi] = 0;
        op[oi + 1] = 0;
        op[oi + 2] = 0;
        op[oi + 3] = 255;
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

// ── Auto board detection ─────────────────────────────────────────────────────

/**
 * Heuristically locate the chessboard within the image using edge-energy
 * density. A board is a high-contrast grid, so its gradient energy dominates the
 * photo; trimming the low-energy margins yields a tight box around the board.
 *
 * Returns fractional bounds {x,y,w,h} in [0,1] relative to the image, or null
 * when no board-like region stands out (the caller then falls back to a
 * centered default box).
 */
function detectBoardFrac(img: HTMLImageElement): Rect | null {
  const nW = img.naturalWidth;
  const nH = img.naturalHeight;
  if (!nW || !nH) return null;

  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(nW, nH));
  const w = Math.max(8, Math.round(nW * scale));
  const h = Math.max(8, Math.round(nH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Cross-origin taint or similar — let the caller use the default box.
    return null;
  }

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * pixels[i * 4] +
      0.587 * pixels[i * 4 + 1] +
      0.114 * pixels[i * 4 + 2];
  }

  // Gradient magnitude per pixel, plus per-column / per-row energy profiles.
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
      colE[x] += m;
      rowE[y] += m;
      total += m;
    }
  }
  if (total <= 0) return null;

  // Trim a small fraction of the total energy off each tail of a profile to
  // discard quiet background margins, keeping the dense central region.
  const trim = (profile: Float32Array, frac: number): [number, number] => {
    let sum = 0;
    for (let i = 0; i < profile.length; i++) sum += profile[i];
    const target = sum * frac;
    let acc = 0;
    let lo = 0;
    for (let i = 0; i < profile.length; i++) {
      acc += profile[i];
      if (acc >= target) {
        lo = i;
        break;
      }
    }
    acc = 0;
    let hi = profile.length - 1;
    for (let i = profile.length - 1; i >= 0; i--) {
      acc += profile[i];
      if (acc >= target) {
        hi = i;
        break;
      }
    }
    return [lo, Math.max(lo, hi)];
  };

  const TRIM = 0.05;
  const [x0, x1] = trim(colE, TRIM);
  const [y0, y1] = trim(rowE, TRIM);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  // Reject degenerate detections (too small to be a usable board).
  if (bw < w * 0.15 || bh < h * 0.15) return null;

  // A real board concentrates far more edge energy per pixel than its
  // surroundings. If the box isn't meaningfully denser than the whole frame,
  // treat it as "no board" and let the caller use the default box.
  let inside = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) inside += mag[y * w + x];
  }
  const insideArea = bw * bh;
  const totalArea = w * h;
  const density = inside / insideArea / (total / totalArea);
  if (density < 1.25) return null;

  // Pad slightly so edge ranks/files aren't clipped, then clamp to [0,1].
  const padX = bw * 0.03;
  const padY = bh * 0.03;
  const fx0 = Math.max(0, (x0 - padX) / w);
  const fy0 = Math.max(0, (y0 - padY) / h);
  const fx1 = Math.min(1, (x1 + 1 + padX) / w);
  const fy1 = Math.min(1, (y1 + 1 + padY) / h);
  return { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 };
}

/**
 * Crop tool with two modes:
 *  - "crop": drag an axis-aligned box over the board (fast, no distortion).
 *  - "straighten": drag four corners onto a tilted/angled board; the selection
 *    is perspective-warped to a square so the board sits flat for scanning.
 * Either mode exports a JPEG blob via onCrop.
 */
export default function ImageCropper({
  imageUrl,
  onCrop,
  onCancel,
  busy = false,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("crop");
  const [working, setWorking] = useState(false);

  // Displayed image box (offset + size) within the container, in CSS px.
  const [imgBox, setImgBox] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  // Crop rectangle in displayed (CSS) px, relative to the container.
  const [crop, setCrop] = useState<Rect | null>(null);
  // Straighten quad corners in displayed (CSS) px, relative to the container.
  const [quad, setQuad] = useState<Quad | null>(null);

  // Auto-detected board bounds as fractions [0,1] of the image, or null when no
  // board stood out. Computed once per image load and reused across re-measures.
  const boardFracRef = useRef<Rect | null>(null);
  // Mirrors whether the current box came from auto-detection (for the hint text).
  const [autoFramed, setAutoFramed] = useState(false);

  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startRect: Rect;
  } | null>(null);
  const quadDragRef = useRef<{
    corner: QuadCorner;
    startX: number;
    startY: number;
    startPt: Point;
  } | null>(null);

  // Measure the displayed image and (re)initialise the crop box + quad.
  const measure = useCallback((reset: boolean) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const box: Rect = {
      x: iRect.left - cRect.left,
      y: iRect.top - cRect.top,
      w: iRect.width,
      h: iRect.height,
    };
    setImgBox(box);

    // Re-detect the board only on a fresh load/reset; reuse the result otherwise.
    if (reset) {
      boardFracRef.current = detectBoardFrac(img);
    }
    const frac = boardFracRef.current;
    setAutoFramed(!!frac);

    setCrop((prev) => {
      if (!reset && prev) return prev;
      if (frac) {
        return {
          x: box.x + frac.x * box.w,
          y: box.y + frac.y * box.h,
          w: frac.w * box.w,
          h: frac.h * box.h,
        };
      }
      const size = Math.min(box.w, box.h) * 0.8;
      return {
        x: box.x + (box.w - size) / 2,
        y: box.y + (box.h - size) / 2,
        w: size,
        h: size,
      };
    });
    setQuad((prev) => {
      if (!reset && prev) return prev;
      if (frac) {
        const lx = box.x + frac.x * box.w;
        const ty = box.y + frac.y * box.h;
        const rx = box.x + (frac.x + frac.w) * box.w;
        const by = box.y + (frac.y + frac.h) * box.h;
        return {
          tl: { x: lx, y: ty },
          tr: { x: rx, y: ty },
          br: { x: rx, y: by },
          bl: { x: lx, y: by },
        };
      }
      const ix = box.w * 0.15;
      const iy = box.h * 0.15;
      return {
        tl: { x: box.x + ix, y: box.y + iy },
        tr: { x: box.x + box.w - ix, y: box.y + iy },
        br: { x: box.x + box.w - ix, y: box.y + box.h - iy },
        bl: { x: box.x + ix, y: box.y + box.h - iy },
      };
    });
  }, []);

  useEffect(() => {
    const onResize = () => measure(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  const clampToImage = useCallback(
    (r: Rect): Rect => {
      const minX = imgBox.x;
      const minY = imgBox.y;
      const maxX = imgBox.x + imgBox.w;
      const maxY = imgBox.y + imgBox.h;
      let { x, y, w, h } = r;
      w = Math.max(MIN_SIZE, Math.min(w, imgBox.w));
      h = Math.max(MIN_SIZE, Math.min(h, imgBox.h));
      x = Math.max(minX, Math.min(x, maxX - w));
      y = Math.max(minY, Math.min(y, maxY - h));
      return { x, y, w, h };
    },
    [imgBox],
  );

  const clampPoint = useCallback(
    (p: Point): Point => ({
      x: Math.max(imgBox.x, Math.min(p.x, imgBox.x + imgBox.w)),
      y: Math.max(imgBox.y, Math.min(p.y, imgBox.y + imgBox.h)),
    }),
    [imgBox],
  );

  const onCropPointerDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      if (!crop) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...crop },
      };
    },
    [crop],
  );

  const onQuadPointerDown = useCallback(
    (corner: QuadCorner) => (e: React.PointerEvent) => {
      if (!quad) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      quadDragRef.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startPt: { ...quad[corner] },
      };
    },
    [quad],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const qDrag = quadDragRef.current;
      if (qDrag) {
        const dx = e.clientX - qDrag.startX;
        const dy = e.clientY - qDrag.startY;
        setQuad((prev) =>
          prev
            ? {
                ...prev,
                [qDrag.corner]: clampPoint({
                  x: qDrag.startPt.x + dx,
                  y: qDrag.startPt.y + dy,
                }),
              }
            : prev,
        );
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const s = drag.startRect;
      let next: Rect;
      if (drag.handle === "move") {
        next = { ...s, x: s.x + dx, y: s.y + dy };
      } else {
        let { x, y, w, h } = s;
        if (drag.handle === "nw") {
          x = s.x + dx;
          y = s.y + dy;
          w = s.w - dx;
          h = s.h - dy;
        } else if (drag.handle === "ne") {
          y = s.y + dy;
          w = s.w + dx;
          h = s.h - dy;
        } else if (drag.handle === "sw") {
          x = s.x + dx;
          w = s.w - dx;
          h = s.h + dy;
        } else if (drag.handle === "se") {
          w = s.w + dx;
          h = s.h + dy;
        }
        if (w < MIN_SIZE) {
          w = MIN_SIZE;
          if (drag.handle === "nw" || drag.handle === "sw")
            x = s.x + s.w - MIN_SIZE;
        }
        if (h < MIN_SIZE) {
          h = MIN_SIZE;
          if (drag.handle === "nw" || drag.handle === "ne")
            y = s.y + s.h - MIN_SIZE;
        }
        next = { x, y, w, h };
      }
      setCrop(clampToImage(next));
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current || quadDragRef.current) {
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      }
      dragRef.current = null;
      quadDragRef.current = null;
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
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const scaleX = naturalW / imgBox.w;
    const scaleY = naturalH / imgBox.h;
    const sx = Math.round((crop.x - imgBox.x) * scaleX);
    const sy = Math.round((crop.y - imgBox.y) * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/jpeg",
      0.95,
    );
  }, [crop, imgBox, onCrop]);

  const doStraighten = useCallback(() => {
    const img = imgRef.current;
    if (!img || !quad || imgBox.w === 0) return;
    setWorking(true);
    // Defer so the spinner can paint before the (sync) warp work runs.
    requestAnimationFrame(() => {
      try {
        const scaleX = img.naturalWidth / imgBox.w;
        const scaleY = img.naturalHeight / imgBox.h;
        const toNatural = (p: Point): Point => ({
          x: (p.x - imgBox.x) * scaleX,
          y: (p.y - imgBox.y) * scaleY,
        });
        const srcPts = [quad.tl, quad.tr, quad.br, quad.bl].map(toNatural);

        // Output size ≈ average board edge length, clamped for performance.
        const dist = (p: Point, q: Point) =>
          Math.hypot(p.x - q.x, p.y - q.y);
        const avgEdge =
          (dist(srcPts[0], srcPts[1]) +
            dist(srcPts[1], srcPts[2]) +
            dist(srcPts[2], srcPts[3]) +
            dist(srcPts[3], srcPts[0])) /
          4;
        const outSize = Math.round(
          Math.max(256, Math.min(900, avgEdge)),
        );

        const canvas = perspectiveWarp(img, srcPts, outSize);
        if (!canvas) {
          setWorking(false);
          return;
        }
        canvas.toBlob(
          (blob) => {
            setWorking(false);
            if (blob) onCrop(blob);
          },
          "image/jpeg",
          0.95,
        );
      } catch {
        setWorking(false);
      }
    });
  }, [quad, imgBox, onCrop]);

  const handleStyle =
    "absolute h-4 w-4 rounded-full border-2 border-white bg-primary shadow touch-none";
  const isBusy = busy || working;

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setMode(v as Mode)}
        className="justify-center"
      >
        <ToggleGroupItem value="crop" className="gap-1.5" disabled={isBusy}>
          <Crop className="h-4 w-4" /> Crop
        </ToggleGroupItem>
        <ToggleGroupItem
          value="straighten"
          className="gap-1.5"
          disabled={isBusy}
        >
          <Frame className="h-4 w-4" /> Straighten
        </ToggleGroupItem>
      </ToggleGroup>

      <div
        ref={containerRef}
        className="relative mx-auto flex max-h-[60vh] w-full select-none items-center justify-center overflow-hidden rounded-lg bg-black/90"
      >
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
            {/* Dark overlay outside the crop box */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "rgba(0,0,0,0.5)",
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${crop.y}px, ${crop.x}px ${crop.y}px, ${crop.x}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y}px, 0 ${crop.y}px)`,
              }}
            />
            {/* Crop box */}
            <div
              onPointerDown={onCropPointerDown("move")}
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] touch-none"
              style={{
                left: crop.x,
                top: crop.y,
                width: crop.w,
                height: crop.h,
              }}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/25" />
                ))}
              </div>
            </div>
            {/* Corner handles */}
            <div
              onPointerDown={onCropPointerDown("nw")}
              className={`${handleStyle} cursor-nwse-resize`}
              style={{ left: crop.x - 8, top: crop.y - 8 }}
            />
            <div
              onPointerDown={onCropPointerDown("ne")}
              className={`${handleStyle} cursor-nesw-resize`}
              style={{ left: crop.x + crop.w - 8, top: crop.y - 8 }}
            />
            <div
              onPointerDown={onCropPointerDown("sw")}
              className={`${handleStyle} cursor-nesw-resize`}
              style={{ left: crop.x - 8, top: crop.y + crop.h - 8 }}
            />
            <div
              onPointerDown={onCropPointerDown("se")}
              className={`${handleStyle} cursor-nwse-resize`}
              style={{ left: crop.x + crop.w - 8, top: crop.y + crop.h - 8 }}
            />
          </>
        )}

        {mode === "straighten" && quad && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <polygon
                points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
                fill="rgba(0,0,0,0.0)"
                stroke="white"
                strokeWidth={2}
              />
              <line
                x1={(quad.tl.x + quad.tr.x) / 2}
                y1={(quad.tl.y + quad.tr.y) / 2}
                x2={(quad.bl.x + quad.br.x) / 2}
                y2={(quad.bl.y + quad.br.y) / 2}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
              />
              <line
                x1={(quad.tl.x + quad.bl.x) / 2}
                y1={(quad.tl.y + quad.bl.y) / 2}
                x2={(quad.tr.x + quad.br.x) / 2}
                y2={(quad.tr.y + quad.br.y) / 2}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
              />
            </svg>
            {(["tl", "tr", "br", "bl"] as QuadCorner[]).map((corner) => (
              <div
                key={corner}
                onPointerDown={onQuadPointerDown(corner)}
                className={`${handleStyle} cursor-grab`}
                style={{ left: quad[corner].x - 8, top: quad[corner].y - 8 }}
              />
            ))}
          </>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "crop"
          ? autoFramed
            ? "We auto-framed the board for you — adjust the box if needed. Tighter crops scan more accurately."
            : "Drag the box over the board, or pull the corners to resize. Tighter crops scan more accurately."
          : "Drag each corner onto the board's corners. Tilted or angled photos are flattened to a square for a cleaner scan."}
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => measure(true)}
          disabled={isBusy}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isBusy}>
          Cancel
        </Button>
        {mode === "crop" ? (
          <Button className="gap-2" onClick={doCrop} disabled={isBusy}>
            <Crop className="h-4 w-4" /> Use this crop
          </Button>
        ) : (
          <Button className="gap-2" onClick={doStraighten} disabled={isBusy}>
            <Frame className="h-4 w-4" />
            {working ? "Straightening…" : "Straighten & use"}
          </Button>
        )}
      </div>
    </div>
  );
}
