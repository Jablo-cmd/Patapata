import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, LogoMark, Text, Wordmark } from '@/components/ui';
import { useBadges } from '@/lib/hooks';
import { useTheme } from '@/theme';

/** Header for tab screens: brand or title, search and notifications. */
export function AppHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const { colors, spacing, layout, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadNotifications } = useBadges();
  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          minHeight: 56,
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
        }}>
        {title ? (
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LogoMark size={28} onDark={dark} />
            <Wordmark size={24} color={colors.text} />
          </View>
        )}
        {right}
        <IconButton icon="search" label="Search" onPress={() => router.push('/search')} />
        <IconButton
          icon="notifications-outline"
          label="Notifications"
          badge={unreadNotifications}
          onPress={() => router.push('/notifications')}
          testID="header-notifications"
        />
      </View>
    </View>
  );
}
