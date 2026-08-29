import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { Platform } from "react-native";

import { useSettings } from "@/lib/settings-store";

/**
 * Haptics wrapper that respects the user's setting and no-ops on web, where the
 * expo-haptics calls reject rather than silently doing nothing.
 */
export function useHaptics() {
  const enabled = useSettings((s) => s.haptics) && Platform.OS !== "web";

  const run = useCallback(
    (fn: () => Promise<void>) => {
      if (!enabled) return;
      void fn().catch(() => {
        // Haptics are decorative — never let an unsupported device break a press.
      });
    },
    [enabled],
  );

  return useMemo(
    () => ({
      tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      select: () => run(() => Haptics.selectionAsync()),
      heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      success: () =>
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warn: () =>
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    }),
    [run],
  );
}
