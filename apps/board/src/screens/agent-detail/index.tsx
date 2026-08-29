import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AGENTS_BY_ID, type AgentId } from "@/agents/roster";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { useHaptics } from "@/hooks/use-haptics";
import { colors, radius, shadows, spacing } from "@/theme";

export function AgentDetail({ agentId }: { agentId: string }) {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  const agent = AGENTS_BY_ID[agentId as AgentId];

  if (!agent) {
    return (
      <Screen>
        <View style={[styles.missing, { paddingTop: insets.top + spacing.xxl }]}>
          <ThemedText variant="title">No such member.</ThemedText>
          <Button title="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            onPress={() => {
              haptics.tap();
              router.back();
            }}
          >
            <Ionicons name="close" size={24} color={colors.secondaryLabel} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <AgentAvatar agent={agent} size="lg" speaking />
          <View style={styles.heroText}>
            <ThemedText variant="overline">{agent.role}</ThemedText>
            <ThemedText variant="largeTitle">{agent.name}</ThemedText>
          </View>
        </View>

        <ThemedText variant="body" style={styles.bio}>
          {agent.bio}
        </ThemedText>

        <Block label="Lens">
          <ThemedText variant="body">{agent.lens}</ThemedText>
        </Block>

        <Block label="What they push for">
          <ThemedText variant="body" style={styles.quote}>
            “{agent.tagline}”
          </ThemedText>
        </Block>

        <Block label="Character prompt">
          <ThemedText variant="mono">{agent.systemPrompt}</ThemedText>
        </Block>
      </ScrollView>
    </Screen>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <ThemedText variant="overline">{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  bio: {
    color: colors.secondaryLabel,
  },
  block: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: shadows.card,
    padding: spacing.lg,
  },
  quote: {
    color: colors.label,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
