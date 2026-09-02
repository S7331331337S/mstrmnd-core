import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRESETS, SEATABLE_AGENTS, type AgentId } from "@/agents/roster";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { Wordmark } from "@/components/wordmark";
import { useHaptics } from "@/hooks/use-haptics";
import { useSessions } from "@/lib/session-store";
import { useSettings } from "@/lib/settings-store";
import { colors, fonts, radius, shadows, spacing } from "@/theme";

import { SeatPicker } from "./seat-picker";

const STARTERS = [
  "Should I raise a seed round or bootstrap for another year?",
  "We have three months of runway and two directions. Which one?",
  "Is it time to fire our biggest client?",
  "Should we rebuild the product or keep patching it?",
];

export function Table() {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  const createSession = useSessions((s) => s.create);
  const hosted = useSettings((s) => Boolean(s.token && s.osBaseUrl));
  const depth = useSettings((s) => s.depth);

  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [presetId, setPresetId] = useState(PRESETS[1].id);
  const [members, setMembers] = useState<AgentId[]>(PRESETS[1].members);

  const canConvene = topic.trim().length >= 8 && members.length > 0;

  const turnCount = useMemo(
    () => (depth === "full" ? members.length * 2 + 1 : members.length + 1),
    [depth, members.length],
  );

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    haptics.select();
    setPresetId(id);
    setMembers(preset.members);
  };

  const toggleMember = (agentId: AgentId) => {
    haptics.select();
    setPresetId("custom");
    setMembers((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    );
  };

  const convene = () => {
    if (!canConvene) return;
    haptics.heavy();
    const session = createSession({ topic, context, members });
    setTopic("");
    setContext("");
    setShowContext(false);
    router.push(`/room/${session.id}`);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.masthead}>
            <Wordmark />
            {/* Two-tone display heading: the grey line sets up the ink one. */}
            <View style={styles.hero}>
              <ThemedText variant="hero" style={styles.heroMuted}>
                Put it to
              </ThemedText>
              <ThemedText variant="hero">the board</ThemedText>
            </View>
          </View>

          {!hosted ? (
            <Animated.View entering={FadeIn} style={styles.notice}>
              <Ionicons name="flash-outline" size={15} color={colors.secondaryLabel} />
              <ThemedText variant="caption" style={{ flex: 1, color: colors.secondaryLabel }}>
                Running the offline board. Sign in to MSTRMND OS in Settings for a live
                deliberation.
              </ThemedText>
            </Animated.View>
          ) : null}

          <View style={styles.field}>
            <ThemedText variant="overline">The question</ThemedText>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="What decision are you actually stuck on?"
              placeholderTextColor={colors.tertiaryLabel}
              multiline
              style={[styles.input, styles.topicInput]}
              maxLength={400}
            />

            {topic.length === 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.starters}
              >
                {STARTERS.map((starter) => (
                  <Pressable
                    key={starter}
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.tap();
                      setTopic(starter);
                    }}
                    style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
                  >
                    <ThemedText variant="caption" numberOfLines={1}>
                      {starter}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <Animated.View layout={LinearTransition} style={styles.field}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.tap();
                setShowContext((v) => !v);
              }}
              style={styles.contextToggle}
            >
              <ThemedText variant="overline">Context</ThemedText>
              <Ionicons
                name={showContext ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.tertiaryLabel}
              />
            </Pressable>

            {showContext ? (
              <Animated.View entering={FadeIn}>
                <TextInput
                  value={context}
                  onChangeText={setContext}
                  placeholder="Numbers, constraints, what you've already tried. The board argues better with facts."
                  placeholderTextColor={colors.tertiaryLabel}
                  multiline
                  style={[styles.input, styles.contextInput]}
                  maxLength={2000}
                />
              </Animated.View>
            ) : null}
          </Animated.View>

          <SeatPicker
            agents={SEATABLE_AGENTS}
            presets={PRESETS}
            presetId={presetId}
            members={members}
            onPreset={applyPreset}
            onToggle={toggleMember}
          />
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 76 }]}>
          <View style={styles.dockMeta}>
            <ThemedText variant="caption">
              {members.length} seated
            </ThemedText>
            <ThemedText variant="caption" style={{ color: colors.tertiaryLabel }}>
              {turnCount} turns · {depth === "full" ? "full debate" : "quick round"}
            </ThemedText>
          </View>
          <Button
            title="Convene the board"
            size="lg"
            disabled={!canConvene}
            onPress={convene}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  masthead: {
    gap: spacing.lg,
  },
  hero: {
    gap: 0,
  },
  heroMuted: {
    color: colors.tertiaryLabel,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: shadows.card,
    padding: spacing.md,
  },
  field: {
    gap: spacing.md,
  },
  input: {
    boxShadow: shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    color: colors.label,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  topicInput: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  contextInput: {
    minHeight: 88,
    fontSize: 14,
    textAlignVertical: "top",
  },
  contextToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starters: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  starter: {
    boxShadow: shadows.card,
    maxWidth: 230,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
  dockMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
