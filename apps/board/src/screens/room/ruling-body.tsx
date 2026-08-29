import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { colors, radius, spacing } from "@/theme";

const HEADINGS = ["THE CALL", "WHY", "THE REAL DISAGREEMENT", "DO THIS WEEK"] as const;

type Section = { heading: string; body: string };

/**
 * The chair is prompted to answer in four labelled sections. Parse them so the
 * call reads as a verdict rather than another paragraph — and fall back to plain
 * text whenever the model doesn't follow the format, which it sometimes won't.
 *
 * THE CALL is rendered inverted. With no accent color available, flipping to ink
 * is the strongest emphasis in the system, and it's reserved for exactly this.
 */
export function RulingBody({ text }: { text: string }) {
  const sections = parseSections(text);

  if (!sections.length) {
    return <ThemedText variant="body">{text}</ThemedText>;
  }

  return (
    <View style={styles.root}>
      {sections.map((section, index) => {
        const isCall = index === 0;

        if (isCall) {
          return (
            <View key={section.heading} style={styles.callBlock}>
              <ThemedText variant="overline" style={styles.callLabel}>
                {section.heading}
              </ThemedText>
              <ThemedText variant="title" style={styles.callText}>
                {section.body}
              </ThemedText>
            </View>
          );
        }

        return (
          <View key={section.heading} style={styles.block}>
            <ThemedText variant="overline">{section.heading}</ThemedText>
            <ThemedText variant="body" style={styles.bodyText}>
              {section.body}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function parseSections(text: string): Section[] {
  const found: { heading: string; start: number; end: number }[] = [];

  for (const heading of HEADINGS) {
    // Match the heading only on its own line, so a mention inside prose is ignored.
    const match = new RegExp(
      `^\\s*#{0,3}\\s*\\*{0,2}${heading}\\*{0,2}\\s*:?\\s*$`,
      "im",
    ).exec(text);
    if (match?.index !== undefined) {
      found.push({ heading, start: match.index, end: match.index + match[0].length });
    }
  }

  if (found.length < 2) return [];

  found.sort((a, b) => a.start - b.start);

  return found
    .map((entry, index) => ({
      heading: entry.heading,
      body: text.slice(entry.end, found[index + 1]?.start ?? text.length).trim(),
    }))
    .filter((section) => section.body.length > 0);
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xl,
  },
  block: {
    gap: spacing.sm,
  },
  callBlock: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.lg,
  },
  callLabel: {
    color: colors.onInkMuted,
  },
  callText: {
    color: colors.onInk,
  },
  bodyText: {
    color: colors.secondaryLabel,
  },
});
