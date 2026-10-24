import { Stack as RouterStack, useLocalSearchParams } from 'expo-router';

import { Banner, EmptyState, Screen, Stack, Text } from '@/components/ui';
import { LEGAL_DOCS } from '@/content/legal';

export default function LegalDocument() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL_DOCS[doc ?? ''];
  if (!content) {
    return (
      <Screen edges={['left', 'right']}>
        <EmptyState title="Page not found" />
      </Screen>
    );
  }
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <RouterStack.Screen options={{ title: content.title }} />
      <Stack gap={16}>
        <Text variant="title" accessibilityRole="header">
          {content.title}
        </Text>
        <Banner tone="warning">{content.updated}</Banner>
        {content.sections.map((s) => (
          <Stack key={s.heading} gap={6}>
            <Text variant="heading">{s.heading}</Text>
            <Text color="textMuted">{s.body}</Text>
          </Stack>
        ))}
      </Stack>
    </Screen>
  );
}
