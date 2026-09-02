"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createWebGlField } from "./field-webgl";
import type { FieldBackend, FieldPointer } from "./field-types";

function trackPointer(canvas: HTMLCanvasElement, dest: FieldPointer) {
  const update = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    dest.x = (clientX - rect.left) / Math.max(rect.width, 1);
    dest.y = (clientY - rect.top) / Math.max(rect.height, 1);
  };
  const onMove = (event: PointerEvent) => update(event.clientX, event.clientY);
  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerdown", onMove, { passive: true });
  return () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerdown", onMove);
  };
}

export function FieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backend, setBackend] = useState<FieldBackend | "failed" | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointer: FieldPointer = { x: 0.5, y: 0.42 };
    const stopPointer = trackPointer(canvas, pointer);
    let dispose: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      try {
        const { createWebGpuField } = await import("./field-webgpu");
        const gpu = await createWebGpuField(canvas, () => pointer);
        if (cancelled) {
          gpu.dispose();
          return;
        }
        dispose = () => gpu.dispose();
        setBackend("webgpu");
        return;
      } catch {
        // Cloud browsers often lack WebGPU; WebGL2 is the live demo path.
      }
      if (cancelled) return;
      try {
        const gl = createWebGlField(canvas, () => pointer);
        dispose = () => gl.dispose();
        setBackend("webgl2");
      } catch {
        setBackend("failed");
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopPointer();
      dispose?.();
    };
  }, []);

  const badge =
    backend === null ? "BOOTING" : backend === "failed" ? "NO GPU" : backend.toUpperCase();

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0a0a0b]">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,10,11,0.22),transparent_18%,transparent_78%,rgba(10,10,11,0.45))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-6 font-mono text-[11px] tracking-[0.28em] text-[#e8e2d0]/80">
        <div>
          <Link href="/" className="pointer-events-auto text-[#e8e2d0] hover:text-[#e8e2d0]">
            MSTRMND
          </Link>
          <div className="mt-1 text-[#e8e2d0]/45">FIELD</div>
        </div>
        <div className="text-right">
          <div>{badge}</div>
          <div className="mt-1 text-[#e8e2d0]/45">POINTER MOVES THE LAMP</div>
        </div>
      </div>
    </div>
  );
}
