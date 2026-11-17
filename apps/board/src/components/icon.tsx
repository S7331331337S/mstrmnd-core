import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

/**
 * Ionicons rendered as a glyph from an icon font. On Android TalkBack would
 * otherwise read the private-use codepoint (e.g. "\uf356, Table") as part of the
 * parent button, so every icon here is hidden from assistive tech. Anything that
 * needs a spoken name must put an explicit `accessibilityLabel` on its container.
 */
export function Icon(props: ComponentProps<typeof Ionicons>) {
  return (
    <Ionicons
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...props}
    />
  );
}
