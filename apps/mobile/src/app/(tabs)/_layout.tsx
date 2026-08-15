import { MessageCircle, Radio, Search, Settings } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useTheme } from '@/theme/theme-provider';
import { TAB_BAR_HEIGHT } from '@/theme/layout';

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.foregroundSubtle,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: 'IBMPlexMono_500Medium',
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 8,
        },
        tabBarBackground: () => <GlassSurface variant="bar" edge="top" className="flex-1" />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="alliance"
        options={{
          title: 'Alliance',
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: 'Memory',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
