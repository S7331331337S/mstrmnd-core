"use client";

import { useEffect, useState } from "react";

/**
 * Cycles the MSTRMND wordmark through Geist Pixel shape variants
 * (square → grid → circle → triangle → line) with a per-glyph stagger —
 * the dither / split-flap vibe from vercel.com/font, without a second hue.
 */
const VARIANTS = [
  "var(--font-geist-pixel-square)",
  "var(--font-geist-pixel-grid)",
  "var(--font-geist-pixel-circle)",
  "var(--font-geist-pixel-triangle)",
  "var(--font-geist-pixel-line)",
] as const;

const LABEL = "MSTRMND";
const TICK_MS = 140;

export function PixelWordmark({
  className = "text-sm tracking-[0.35em] text-foreground",
}: {
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    setAnimate(true);
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      className={className}
      aria-label={LABEL}
      // Keep layout stable while glyphs swap shape metrics.
      style={{ display: "inline-flex" }}
    >
      {LABEL.split("").map((ch, i) => {
        const variant = animate
          ? VARIANTS[(tick + i) % VARIANTS.length]
          : VARIANTS[0];
        return (
          <span
            key={`${ch}-${i}`}
            aria-hidden="true"
            style={{
              fontFamily: `${variant}, var(--font-sans), sans-serif`,
              display: "inline-block",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
