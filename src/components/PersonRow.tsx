import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export function PersonRow({
  person,
  subtitle,
  right,
  onPress,
}: {
  person: { id: string; username: string | null; display_name: string | null; avatar_path: string | null };
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const { spacing } = useTheme();
  const open = onPress ?? (() => person.username && router.push(`/user/${person.username}`));
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${person.display_name ?? 'Member'}, @${person.username ?? ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.75 : 1,
      })}>
      <Avatar path={person.avatar_path} name={person.display_name} seed={person.id} size={48} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {person.display_name || 'Patapata member'}
        </Text>
        <Text variant="small" color="textMuted" numberOfLines={1}>
          {subtitle ?? (person.username ? `@${person.username}` : '')}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}
