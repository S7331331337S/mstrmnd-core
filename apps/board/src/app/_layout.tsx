import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useSessions } from "@/lib/session-store";
import { useSettings } from "@/lib/settings-store";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const settingsHydrated = useSettings((s) => s.hydrated);
  const sessionsHydrated = useSessions((s) => s.hydrated);

  useEffect(() => {
    void useSettings.getState().hydrate();
    void useSessions.getState().hydrate();
  }, []);

  const ready = fontsLoaded && settingsHydrated && sessionsHydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Holding the splash until state is loaded keeps the first frame from
  // flashing an empty roster or the wrong engine badge.
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="room/[id]" />
          <Stack.Screen
            name="agent/[id]"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
