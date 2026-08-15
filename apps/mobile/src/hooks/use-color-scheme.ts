import { useCallback, useEffect, useState } from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { themes, type ColorScheme } from '@/theme/theme';

export type ThemePreference = ColorScheme | 'system';

const STORAGE_KEY = 'mstrmnd.theme-preference';

/**
 * Wraps NativeWind's color scheme (drives the `dark:` className variant)
 * with a persisted user preference, so a manual Obsidian/Paper choice in
 * Settings survives app restarts instead of always following the system.
 */
export function useAppColorScheme() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      const next = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      setPreferenceState(next);
      setColorScheme(next);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      setColorScheme(next);
      void AsyncStorage.setItem(STORAGE_KEY, next);
    },
    [setColorScheme],
  );

  const resolved: ColorScheme = colorScheme === 'dark' ? 'dark' : 'light';

  return {
    scheme: resolved,
    theme: themes[resolved],
    preference,
    setPreference,
    hydrated,
  };
}
