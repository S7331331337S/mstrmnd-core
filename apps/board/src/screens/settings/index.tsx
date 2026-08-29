import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { useHaptics } from "@/hooks/use-haptics";
import { useSessions } from "@/lib/session-store";
import { MODELS, useSettings } from "@/lib/settings-store";
import { colors, fonts, radius, shadows, spacing } from "@/theme";

export function Settings() {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  const { apiKey, model, depth, haptics: hapticsOn } = useSettings();
  const { setApiKey, setModel, setDepth, setHaptics } = useSettings();
  const clearSessions = useSessions((s) => s.clear);
  const sessionCount = useSessions((s) => s.sessions.length);

  const [draftKey, setDraftKey] = useState("");
  const [saving, setSaving] = useState(false);

  const saveKey = async () => {
    setSaving(true);
    await setApiKey(draftKey);
    setSaving(false);
    setDraftKey("");
    haptics.success();
  };

  const removeKey = async () => {
    await setApiKey(null);
    haptics.warn();
  };

  const confirmClear = () => {
    if (sessionCount === 0) return;
    Alert.alert(
      "Delete all sessions?",
      `${sessionCount} session${sessionCount === 1 ? "" : "s"} will be permanently removed from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: () => {
            clearSessions();
            haptics.warn();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="largeTitle">Settings</ThemedText>

        <Section title="Engine">
          {apiKey ? (
            <View style={styles.keyActive}>
              <View style={styles.keyRow}>
                <Ionicons name="shield-checkmark" size={18} color={colors.ink} />
                <View style={styles.flex}>
                  <ThemedText variant="headline">Claude connected</ThemedText>
                  <ThemedText variant="caption" style={styles.mask}>
                    {maskKey(apiKey)}
                  </ThemedText>
                </View>
              </View>
              <Button title="Remove key" variant="ghost" size="sm" onPress={() => void removeKey()} />
            </View>
          ) : (
            <View style={styles.keyForm}>
              <ThemedText variant="subhead">
                Without a key the app runs an offline board — scripted stand-ins that
                demonstrate the format but cannot reason about your question.
              </ThemedText>
              <TextInput
                value={draftKey}
                onChangeText={setDraftKey}
                placeholder="sk-ant-…"
                placeholderTextColor={colors.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
              />
              <Button
                title="Connect"
                size="sm"
                loading={saving}
                disabled={draftKey.trim().length < 10}
                onPress={() => void saveKey()}
              />
              <ThemedText variant="caption" style={styles.fine}>
                {Platform.OS === "web"
                  ? "On web the key is kept in browser storage. Prefer the native app for anything real."
                  : "Stored in the device keychain and sent only to api.anthropic.com."}
              </ThemedText>
            </View>
          )}
        </Section>

        <Section title="Model">
          {MODELS.map((option) => {
            const active = option.id === model;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  haptics.select();
                  setModel(option.id);
                }}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.flex}>
                  <ThemedText variant="headline">{option.label}</ThemedText>
                  <ThemedText variant="caption">{option.hint}</ThemedText>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.ink} />
                ) : null}
              </Pressable>
            );
          })}
        </Section>

        <Section title="Format">
          {(
            [
              { id: "full", label: "Full debate", hint: "Openings, crossfire, then the ruling." },
              { id: "quick", label: "Quick round", hint: "Openings and the ruling. Faster, cheaper." },
            ] as const
          ).map((option) => {
            const active = option.id === depth;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  haptics.select();
                  setDepth(option.id);
                }}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.flex}>
                  <ThemedText variant="headline">{option.label}</ThemedText>
                  <ThemedText variant="caption">{option.hint}</ThemedText>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.ink} />
                ) : null}
              </Pressable>
            );
          })}
        </Section>

        <Section title="Feel">
          <View style={styles.option}>
            <View style={styles.flex}>
              <ThemedText variant="headline">Haptics</ThemedText>
              <ThemedText variant="caption">A tap as each member finishes speaking.</ThemedText>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={setHaptics}
              trackColor={{ true: colors.ink, false: colors.ink200 }}
              thumbColor={colors.white}
            />
          </View>
        </Section>

        <Section title="Data">
          <View style={styles.option}>
            <View style={styles.flex}>
              <ThemedText variant="headline">Stored sessions</ThemedText>
              <ThemedText variant="caption">
                {sessionCount === 0
                  ? "Nothing stored. Sessions never leave this device."
                  : `${sessionCount} on this device. Nothing is uploaded.`}
              </ThemedText>
            </View>
          </View>
          <Button
            title="Delete all sessions"
            variant="ghost"
            size="sm"
            disabled={sessionCount === 0}
            onPress={confirmClear}
          />
        </Section>

        <ThemedText variant="caption" style={styles.footer}>
          MSTRMND · built with Expo
        </ThemedText>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="overline">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Show enough of the key to recognise it, never enough to use it. */
function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  flex: { flex: 1, gap: 2 },
  section: {
    gap: spacing.md,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  keyActive: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mask: {
    fontFamily: fonts.medium,
    color: colors.tertiaryLabel,
  },
  keyForm: {
    boxShadow: shadows.card,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.label,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  fine: {
    color: colors.tertiaryLabel,
  },
  option: {
    boxShadow: shadows.card,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionActive: {
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    textAlign: "center",
    color: colors.tertiaryLabel,
    marginTop: spacing.lg,
  },
});
