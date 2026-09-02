import { StyleSheet, View } from "react-native";

import { colors, fonts } from "@/theme";

import { ThemedText } from "./themed-text";

/**
 * Brand lockup: the mark — the board ringed around the chair — beside the name.
 * Solid ink, no gradient. The mark is a shape, not a color.
 */
export function Wordmark({ size = 17 }: { size?: number }) {
  const mark = size * 1.45;
  const chair = mark * 0.32;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          { width: mark, height: mark, borderRadius: mark / 2 },
        ]}
      >
        <View
          style={{
            width: chair,
            height: chair,
            borderRadius: chair / 2,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <ThemedText
        style={{
          fontFamily: fonts.bold,
          fontSize: size,
          letterSpacing: size * 0.1,
          color: colors.label,
        }}
      >
        MSTRMND
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
});
