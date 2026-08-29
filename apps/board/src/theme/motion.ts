import { Easing } from "react-native-reanimated";

export const motion = {
  fast: 150, // press + toggle feedback
  base: 260, // element enter/exit
  slow: 420, // sheets, screen-level surfaces
  /** Deliberate pause between agents speaking, so the room reads as a conversation. */
  beat: 520,
} as const;

export const easing = {
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.quad),
} as const;

export const spring = {
  gentle: { damping: 18, stiffness: 140, mass: 0.9 },
  snappy: { damping: 14, stiffness: 260, mass: 0.7 },
} as const;
