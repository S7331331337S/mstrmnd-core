/**
 * With no color to lean on, shadow does the work of separating surfaces — so it
 * has to be precise. Each level pairs a tight contact shadow with a wider, much
 * softer ambient one, which is what reads as real light rather than a grey box.
 */
export const shadows = {
  /** Resting surfaces: cards, rows, inputs. */
  card: "0 1px 1px rgba(11, 11, 12, 0.03), 0 2px 6px rgba(11, 11, 12, 0.04)",
  /** Surfaces that outrank their neighbours: the ruling, an active sheet. */
  raised: "0 1px 2px rgba(11, 11, 12, 0.04), 0 8px 24px rgba(11, 11, 12, 0.07)",
  /** Floating chrome: docks, popovers. */
  overlay: "0 2px 4px rgba(11, 11, 12, 0.05), 0 20px 48px rgba(11, 11, 12, 0.11)",
  /** The pressed-in look for wells and inactive segmented tracks. */
  inset: "inset 0 1px 2px rgba(11, 11, 12, 0.05)",
} as const;
