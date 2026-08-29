/**
 * MSTRMND palette — monochrome.
 *
 * There is no hue anywhere in this system, including for status. Everything is
 * carried by value, weight and space:
 *
 * - **Identity** is the monogram and the name, never a color.
 * - **State** is fill vs outline — an active element is ink-filled, an inactive
 *   one is a hairline.
 * - **Depth** is a hairline plus a light shadow, or a soft gradient wash. Never
 *   a tint.
 *
 * The greys carry a trace of warmth (a red channel a step above blue). Perfectly
 * neutral greys read cold and cheap at large areas; the warmth is invisible on
 * its own and reads as expensive in aggregate.
 */
const ramp = {
  ink: "#0B0B0C",
  ink800: "#26262A",
  ink600: "#55555C",
  ink500: "#6E6E76",
  ink400: "#8E8E97",
  ink300: "#B4B4BC",
  ink200: "#D8D8DD",
  ink100: "#E9E9EC",
  ink50: "#F4F4F6",
  paper: "#FAFAFB",
  white: "#FFFFFF",
} as const;

export const colors = {
  ...ramp,

  // Surfaces.
  canvas: ramp.paper,
  surface: ramp.white,
  surfaceSunken: ramp.ink50,
  surfaceInverse: ramp.ink,

  // Hairlines. Ink at low alpha rather than a flat grey, so one value works on
  // both paper and white.
  hairline: "#0B0B0C14",
  hairlineStrong: "#0B0B0C24",

  // Text.
  label: ramp.ink,
  secondaryLabel: ramp.ink500,
  tertiaryLabel: ramp.ink400,
  quaternaryLabel: ramp.ink300,

  // On inverted (ink-filled) surfaces.
  onInk: ramp.white,
  onInkMuted: "#FFFFFFA6",
} as const;

/**
 * The page is lit from above: a soft white bleed at the top settling into the
 * canvas grey. This is the monochrome stand-in for a colored glow — inverting it
 * (grey at the top) reads as a dirty page rather than a lit one.
 */
export const wash = ["#FFFFFFFF", "#FFFFFF00"] as const;

/** Ink at an alpha, for hairlines, scrims and pressed states. */
export function alpha(amount: number, hex: string = ramp.ink): string {
  const a = Math.round(Math.max(0, Math.min(1, amount)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
