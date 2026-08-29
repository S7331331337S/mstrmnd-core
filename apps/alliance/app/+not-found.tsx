import { Link, Stack } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { EmptyState, Text } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen className="items-center justify-center">
        <EmptyState
          glyph="404"
          title="This screen doesn't exist"
          description="The route you followed isn't part of the alliance."
          action={
            <Link href="/" className="mt-2">
              <Text tone="accent" weight="semibold">
                Back to Chat
              </Text>
            </Link>
          }
        />
      </Screen>
    </>
  );
}
