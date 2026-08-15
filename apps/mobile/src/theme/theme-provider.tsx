import { createContext, useContext, type PropsWithChildren } from 'react';

import { useAppColorScheme } from '@/hooks/use-color-scheme';

type ThemeContextValue = ReturnType<typeof useAppColorScheme>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const value = useAppColorScheme();

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return ctx;
}
