import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Base height of the floating glass tab bar, excluding the safe-area inset. */
export const TAB_BAR_HEIGHT = 56;

/** Total on-screen height of the floating tab bar, insets included — use to
 * pad any tab screen's scroll content or fixed footer so it isn't hidden
 * behind the translucent bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom;
}
