import type { TextStyle } from "react-native";

import { colors } from "./colors";

/**
 * One typeface, six weights. Inter is deliberately neutral — with no color in
 * the system, the letterforms shouldn't be competing for attention either.
 *
 * Weights come from bundled font files, so weight is set via `fontFamily` and
 * `fontWeight` is omitted — otherwise iOS synthesizes the weight.
 */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/**
 * Optical tracking: large text needs negative tracking to hold together, small
 * caps need positive tracking to breathe. This is most of what separates
 * type that looks considered from type that looks defaulted.
 */
export const type = {
  hero: {
    fontFamily: fonts.bold,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -2.2,
    color: colors.label,
  },
  largeTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.1,
    color: colors.label,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: colors.label,
  },
  headline: {
    fontFamily: fonts.semibold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.24,
    color: colors.label,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: 25,
    letterSpacing: -0.18,
    color: colors.label,
  },
  subhead: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
    color: colors.secondaryLabel,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: -0.05,
    color: colors.secondaryLabel,
  },
  /** All-caps micro label. Wide tracking is what makes small caps legible. */
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.tertiaryLabel,
  },
  /** Monogram / tabular figures. Inter's own, not a second typeface. */
  mono: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: colors.secondaryLabel,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
