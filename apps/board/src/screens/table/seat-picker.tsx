import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { Agent, AgentId, Preset } from "@/agents/roster";
import { AgentAvatar } from "@/components/agent-avatar";
import { ThemedText } from "@/components/themed-text";
import { colors, radius, shadows, spacing } from "@/theme";

/** Preset chips across the top, individual seats below. */
export function SeatPicker({
  agents,
  presets,
  presetId,
  members,
  onPreset,
  onToggle,
}: {
  agents: Agent[];
  presets: Preset[];
  presetId: string;
  members: AgentId[];
  onPreset(id: string): void;
  onToggle(id: AgentId): void;
}) {
  const active = presets.find((p) => p.id === presetId);

  return (
    <View style={styles.root}>
      <View style={styles.section}>
        <ThemedText variant="overline">Tables</ThemedText>

        {/* Segmented pill row — selection is carried by a filled chip, not color. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {presets.map((preset) => {
            const on = preset.id === presetId;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onPreset(preset.id)}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={preset.icon as never}
                  size={15}
                  color={on ? colors.ink : colors.tertiaryLabel}
                />
                <ThemedText
                  variant="headline"
                  style={{ color: on ? colors.ink : colors.secondaryLabel }}
                >
                  {preset.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ThemedText variant="subhead" style={styles.chipHint}>
          {active ? active.description : "Your own selection."}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.seatsHeader}>
          <ThemedText variant="overline">The seats</ThemedText>
          <ThemedText variant="caption" style={{ color: colors.tertiaryLabel }}>
            The Chair always closes
          </ThemedText>
        </View>

        <View style={styles.seats}>
          {agents.map((agent) => {
            const seated = members.includes(agent.id);
            return (
              <Pressable
                key={agent.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: seated }}
                accessibilityLabel={`${agent.name}, ${agent.role}`}
                onPress={() => onToggle(agent.id)}
                style={({ pressed }) => [
                  styles.seat,
                  seated && styles.seatOn,
                  pressed && styles.pressed,
                ]}
              >
                <AgentAvatar agent={agent} size="sm" dimmed={!seated} />

                <View style={styles.seatText}>
                  <ThemedText
                    variant="headline"
                    numberOfLines={1}
                    style={{ color: seated ? colors.ink : colors.secondaryLabel }}
                  >
                    {agent.name}
                  </ThemedText>
                  <ThemedText variant="caption" numberOfLines={2} style={styles.seatTagline}>
                    {agent.tagline}
                  </ThemedText>
                </View>

                {seated ? (
                  <Ionicons name="checkmark-circle" size={19} color={colors.ink} />
                ) : (
                  <Ionicons name="add-circle-outline" size={19} color={colors.tertiaryLabel} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  chipOn: {
    backgroundColor: colors.surfaceSunken,
  },
  chipHint: {
    color: colors.tertiaryLabel,
  },
  seatsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seats: {
    gap: spacing.sm,
  },
  seat: {
    boxShadow: shadows.card,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  seatOn: {
    borderColor: colors.hairlineStrong,
  },
  seatText: {
    flex: 1,
    gap: 2,
  },
  seatTagline: {
    color: colors.tertiaryLabel,
  },
  pressed: {
    opacity: 0.6,
  },
});
