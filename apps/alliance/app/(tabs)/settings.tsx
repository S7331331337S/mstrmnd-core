import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Badge, Card, Divider, Label, SegmentedControl, StatusDot, Text } from '@/components/ui';
import { connections, identity } from '@/lib/identity';
import { useTabBarInset } from '@/theme/layout';
import { useTheme } from '@/theme/theme-provider';
import type { ThemePreference } from '@/hooks/use-color-scheme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Obsidian' },
  { value: 'light', label: 'Paper' },
];

const stateCopy: Record<(typeof connections)[number]['state'], { label: string; status: 'online' | 'idle' | 'offline' }> = {
  connected: { label: 'Connected', status: 'online' },
  demo: { label: 'Demo mode', status: 'idle' },
  offline: { label: 'Offline', status: 'offline' },
};

export default function SettingsScreen() {
  const { preference, setPreference } = useTheme();
  const tabBarInset = useTabBarInset();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarInset + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Label>MSTRMND // SETTINGS</Label>
        <Text variant="title1" weight="semibold" className="mb-5 mt-1">
          Settings
        </Text>

        <SectionLabel>Appearance</SectionLabel>
        <Card padding="md" radius="lg" className="mb-6">
          <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          <Text variant="footnote" tone="subtle" className="mt-3">
            Obsidian is dark-first, brand-true. Paper flips the accent to Ink for daylight use.
          </Text>
        </Card>

        <SectionLabel>Identity</SectionLabel>
        <Card padding="md" radius="lg" className="mb-6 gap-4">
          <IdentityRow title="Values" tags={identity.values} />
          <Divider />
          <IdentityRow title="Interests" tags={identity.interests} />
          <Divider />
          <IdentityRow title="Creative patterns" tags={identity.creativePatterns} />
        </Card>

        <SectionLabel>Connections</SectionLabel>
        <Card padding="none" radius="lg" className="mb-6 overflow-hidden">
          {connections.map((connection, index) => (
            <View key={connection.id}>
              {index > 0 ? <Divider /> : null}
              <View className="flex-row items-center gap-3 px-4 py-3.5">
                <StatusDot status={stateCopy[connection.state].status} />
                <View className="flex-1">
                  <Text variant="callout" weight="medium">
                    {connection.label}
                  </Text>
                  <Text variant="footnote" tone="subtle">
                    {connection.detail}
                  </Text>
                </View>
                <Label tone="subtle">{stateCopy[connection.state].label}</Label>
              </View>
            </View>
          ))}
        </Card>

        <View className="items-center gap-1 pb-6 pt-4">
          <Text variant="footnote" weight="monoMedium" tone="subtle">
            MSTRMND · v0.1.0
          </Text>
          <Text variant="caption" tone="subtle" className="text-center">
            Personal Intelligence Infrastructure. Models change. Your intelligence layer persists.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Label className="mb-2 mt-1 px-1" tone="subtle">
      {children}
    </Label>
  );
}

function IdentityRow({ title, tags }: { title: string; tags: string[] }) {
  return (
    <View>
      <Text variant="footnote" tone="muted" className="mb-2">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </View>
    </View>
  );
}
