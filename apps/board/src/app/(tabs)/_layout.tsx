import { Icon } from "@/components/icon";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, spacing } from "@/theme";

const TABS = [
  { name: "index", title: "Table", icon: "grid-outline" },
  { name: "sessions", title: "History", icon: "time-outline" },
  { name: "roster", title: "Board", icon: "people-outline" },
  { name: "settings", title: "Settings", icon: "options-outline" },
] as const;

/** Icon (28) + label line box (16) + breathing room. Too tight and the label clips. */
const BAR_HEIGHT = 66;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.tertiaryLabel,
        tabBarStyle: [
          styles.bar,
          // Height must include the inset, or the labels clip into the home indicator.
          { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        // Frosted glass over the page; on web this degrades to the solid fill below.
        // expo-blur does not blur on Android here, so a 60% white wash lets page text
        // show through the labels (seen on Settings). Use a near-opaque fill there.
        tabBarBackground: () =>
          Platform.OS === "web" ? null : Platform.OS === "android" ? (
            <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
          ) : (
            <BlurView tint="light" intensity={60} style={StyleSheet.absoluteFill} />
          ),
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            // RN 0.88 widened ColorValue (null | number); Ionicons takes string | NativeColorValue.
            tabBarIcon: ({ color, size }) => (
              <Icon
                name={tab.icon}
                color={typeof color === "number" ? undefined : (color ?? undefined)}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: Platform.OS === "web" ? colors.surface : "transparent",
    elevation: 0,
  },
  androidFill: {
    backgroundColor: "#FFFFFFF5",
  },
  item: {
    paddingTop: spacing.xs,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
