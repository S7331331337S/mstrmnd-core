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

import { signInUrl } from "@/agents/providers/hosted";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { useHaptics } from "@/hooks/use-haptics";
import { useSessions } from "@/lib/session-store";
import { QUALITY, useSettings } from "@/lib/settings-store";
import { colors, fonts, radius, shadows, spacing } from "@/theme";

export function Settings() {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  const { token, email, osBaseUrl, quality, depth, haptics: hapticsOn } = useSettings();
  const { setSession, setOsBaseUrl, setQuality, setDepth, setHaptics } = useSettings();
  const clearSessions = useSessions((s) => s.clear);
  const sessionCount = useSessions((s) => s.sessions.length);

  const [draftUrl, setDraftUrl] = useState(osBaseUrl);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setSaving(true);
    setError(null);
    const url = draftUrl.trim().replace(/\/$/, "");
    setOsBaseUrl(url);
    try {
      const response = await fetch(signInUrl(url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mstrmnd-client": "board",
        },
        body: JSON.stringify({
          email: draftEmail.trim(),
          password: draftPassword,
          client: "board",
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; token?: string; user?: { email?: string } }
        | null;
      if (!response.ok || !body?.token) {
        setError(body?.error || "Could not sign in. Check the OS URL and credentials.");
        haptics.warn();
        return;
      }
      await setSession({ token: body.token, email: body.user?.email ?? draftEmail.trim() });
      setDraftPassword("");
      haptics.success();
    } catch {
      setError("Could not reach MSTRMND OS. Check the URL and that the host is running.");
      haptics.warn();
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    await setSession(null);
    setDraftPassword("");
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
          {token ? (
            <View style={styles.keyActive}>
              <View style={styles.keyRow}>
                <Ionicons name="shield-checkmark" size={18} color={colors.ink} />
                <View style={styles.flex}>
                  <ThemedText variant="headline">MSTRMND OS connected</ThemedText>
                  <ThemedText variant="caption" style={styles.mask}>
                    {email ?? "Session active"}
                  </ThemedText>
                  <ThemedText variant="caption" style={styles.mask}>
                    {osBaseUrl}
                  </ThemedText>
                </View>
              </View>
              <Button title="Disconnect" variant="ghost" size="sm" onPress={() => void disconnect()} />
            </View>
          ) : (
            <View style={styles.keyForm}>
              <ThemedText variant="subhead">
                Without a session the app runs an offline board — scripted stand-ins that
                demonstrate the format but cannot reason about your question.
              </ThemedText>
              <TextInput
                value={draftUrl}
                onChangeText={setDraftUrl}
                placeholder="http://localhost:3001"
                placeholderTextColor={colors.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
              <TextInput
                value={draftEmail}
                onChangeText={setDraftEmail}
                placeholder="Email"
                placeholderTextColor={colors.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                value={draftPassword}
                onChangeText={setDraftPassword}
                placeholder="Password"
                placeholderTextColor={colors.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
              />
              {error ? (
                <ThemedText variant="caption" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
              <Button
                title="Connect"
                size="sm"
                loading={saving}
                disabled={draftUrl.trim().length < 8 || draftEmail.trim().length < 3 || draftPassword.length < 1}
                onPress={() => void connect()}
              />
              <ThemedText variant="caption" style={styles.fine}>
                {Platform.OS === "web"
                  ? "On web the session token is kept in browser storage. Prefer the native app for anything real."
                  : "Stored in the device keychain and sent only to your MSTRMND OS host."}
              </ThemedText>
            </View>
          )}
        </Section>

        <Section title="Quality">
          {QUALITY.map((option) => {
            const active = option.id === quality;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  haptics.select();
                  setQuality(option.id);
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
  error: {
    color: colors.label,
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
