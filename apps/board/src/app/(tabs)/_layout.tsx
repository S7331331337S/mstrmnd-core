import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
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
        tabBarBackground: () =>
          Platform.OS === "web" ? null : (
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} color={color} size={size} />
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
