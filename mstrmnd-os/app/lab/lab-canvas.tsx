"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelWordmark } from "@/app/_components/pixel-wordmark";

type ExperimentId = "circle" | "square" | "ghost" | "glyph";

const EXPERIMENTS: { id: ExperimentId; label: string; index: string }[] = [
  { id: "circle", label: "Circle", index: "01" },
  { id: "square", label: "Square", index: "02" },
  { id: "ghost", label: "Ghost", index: "03" },
  { id: "glyph", label: "Glyph", index: "04" },
];

const BG_CHARS = "+*-.:01x·";
const FG_CHARS = "01";
const PLATINUM = "#e8e2d0";
const OBSIDIAN = "#0a0a0b";

function inCircle(x: number, y: number, cx: number, cy: number, r: number) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inSquare(x: number, y: number, cx: number, cy: number, half: number) {
  return Math.abs(x - cx) <= half && Math.abs(y - cy) <= half;
}

/** Soft Pac-Man-ish ghost silhouette in normalized -1..1 space. */
function inGhost(nx: number, ny: number) {
  // Body: rounded top + wavy bottom
  const body = nx * nx + (ny + 0.15) * (ny + 0.15) * 0.85 < 0.55 && ny < 0.55;
  const wave =
    ny > 0.25 &&
    ny < 0.72 &&
    Math.abs(nx) < 0.72 &&
    Math.sin(nx * Math.PI * 3) * 0.08 + 0.55 > ny;
  return body || wave;
}

/** Lowercase 'a' approximate via two circles + stem. */
function inGlyphA(nx: number, ny: number) {
  const bowl = inCircle(nx, ny, -0.05, 0.05, 0.42) && !inCircle(nx, ny, -0.05, 0.05, 0.18);
  const stem = nx > 0.18 && nx < 0.42 && ny > -0.35 && ny < 0.55;
  return bowl || stem;
}

function shapeMask(
  id: ExperimentId,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const cx = w * 0.5;
  const cy = h * 0.42;
  const scale = Math.min(w, h);
  const nx = (x - cx) / (scale * 0.28);
  const ny = (y - cy) / (scale * 0.28);

  switch (id) {
    case "circle":
      return inCircle(x, y, cx, cy, scale * 0.22);
    case "square":
      return inSquare(x, y, cx, cy, scale * 0.2);
    case "ghost":
      return inGhost(nx, ny);
    case "glyph":
      return inGlyphA(nx, ny);
  }
}

type CellKind = "bg" | "dot" | "sq" | "tri" | "ch";

function pickFg(seed: number): CellKind {
  const t = seed % 1;
  if (t < 0.28) return "dot";
  if (t < 0.5) return "sq";
  if (t < 0.7) return "tri";
  return "ch";
}

function hash(i: number, j: number, salt: number) {
  const n = Math.sin(i * 12.9898 + j * 78.233 + salt * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

export function LabCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0.5, y: 0.45 });
  const [experiment, setExperiment] = useState<ExperimentId>("circle");
  const [readout, setReadout] = useState({ a: 0, b: 0 });
  const expMeta = useMemo(
    () => EXPERIMENTS.find((e) => e.id === experiment)!,
    [experiment],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.fillStyle = OBSIDIAN;
    ctx.fillRect(0, 0, w, h);

    const cell = Math.max(7, Math.floor(10 * dpr));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    const px = pointer.current.x;
    const py = pointer.current.y;
    const lampX = px * w;
    const lampY = py * h;

    let fgCount = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cell + cell * 0.5;
        const y = j * cell + cell * 0.5;
        const inside = shapeMask(experiment, x, y, w, h);
        const dist = Math.hypot(x - lampX, y - lampY);
        const lamp = Math.max(0, 1 - dist / (Math.min(w, h) * 0.55));
        const r = hash(i, j, 1);

        if (inside) {
          fgCount++;
          const kind = pickFg(hash(i, j, 7));
          const alpha = 0.55 + lamp * 0.45;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = PLATINUM;
          const s = cell * (0.35 + hash(i, j, 3) * 0.35);
          if (kind === "dot") {
            ctx.beginPath();
            ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === "sq") {
            ctx.fillRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
          } else if (kind === "tri") {
            ctx.beginPath();
            ctx.moveTo(x, y - s * 0.5);
            ctx.lineTo(x - s * 0.45, y + s * 0.4);
            ctx.lineTo(x + s * 0.45, y + s * 0.4);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.font = `${Math.floor(cell * 0.7)}px ui-monospace, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(FG_CHARS[Math.floor(r * FG_CHARS.length)], x, y);
          }
        } else {
          // Sparse ASCII field
          if (r > 0.62 - lamp * 0.25) continue;
          ctx.globalAlpha = 0.12 + lamp * 0.35;
          ctx.fillStyle = PLATINUM;
          ctx.font = `${Math.floor(cell * 0.55)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const ch = BG_CHARS[Math.floor(hash(i, j, 9) * BG_CHARS.length)];
          ctx.fillText(ch, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
    setReadout({ a: experiment === "circle" ? 0 : fgCount % 1000, b: -Math.round(lampX - w / 2) });
  }, [experiment]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = (e.clientX - rect.left) / Math.max(rect.width, 1);
      pointer.current.y = (e.clientY - rect.top) / Math.max(rect.height, 1);
      draw();
    };
    canvas.addEventListener("pointermove", onMove, { passive: true });
    return () => canvas.removeEventListener("pointermove", onMove);
  }, [draw]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0a0a0b] text-[#e8e2d0]">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <div className="pointer-events-auto">
          <Link href="/" className="inline-flex items-center gap-3">
            <PixelWordmark className="text-sm tracking-[0.16em] text-[#e8e2d0]" />
          </Link>
          <div className="label mt-1 text-[#e8e2d0]/50">LAB · EXPERIMENT</div>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[11px]">
          <span className="border border-[#e8e2d0]/35 bg-[#e8e2d0] px-2 py-0.5 text-[#0a0a0b]">
            {readout.a}
          </span>
          <span className="border border-[#e8e2d0]/35 bg-[#e8e2d0] px-2 py-0.5 text-[#0a0a0b]">
            {readout.b}
          </span>
        </div>
      </div>

      {/* Experiment picker */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-28 flex justify-center gap-2 px-4">
        {EXPERIMENTS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setExperiment(e.id)}
            className={`label-grid border px-3 py-1.5 transition-colors ${
              experiment === e.id
                ? "border-[#e8e2d0] bg-[#e8e2d0] text-[#0a0a0b]"
                : "border-[#e8e2d0]/35 text-[#e8e2d0]/70 hover:text-[#e8e2d0]"
            }`}
          >
            {e.index} {e.label}
          </button>
        ))}
      </div>

      {/* Dotted wordmark label */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-6">
        <div className="relative w-full max-w-lg border border-[#e8e2d0]/4 px-5 py-4">
          <span className="absolute left-3 top-2 font-mono text-[10px] tracking-[0.2em] text-[#e8e2d0]/70">
            {expMeta.index}
          </span>
          <p
            className="text-center text-4xl sm:text-5xl tracking-[0.35em] text-[#e8e2d0]"
            style={{
              fontFamily: "var(--font-geist-pixel-circle), ui-monospace, monospace",
            }}
          >
            {expMeta.label.toUpperCase()}
          </p>
          <p className="label mt-2 text-center text-[#e8e2d0]/45">
            pointer moves the lamp · ascii field
          </p>
        </div>
      </div>
    </div>
  );
}
