import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { FeedList } from '@/components/FeedList';
import { Avatar, EmptyState, SegmentedControl, Text } from '@/components/ui';
import { getMyProfile } from '@/lib/api';
import { useTheme } from '@/theme';

type Scope = 'home' | 'explore';

export default function Home() {
  const [scope, setScope] = useState<Scope>('home');
  const me = useQuery({ queryKey: ['me'], queryFn: getMyProfile });

  const header = (
    <View style={{ gap: 12 }}>
      <Composer name={me.data?.display_name} avatar={me.data?.avatar_path} id={me.data?.id} />
      <QuickLinks />
      <SegmentedControl
        value={scope}
        onChange={setScope}
        options={[
          { value: 'home', label: 'Friends' },
          { value: 'explore', label: 'Across Africa' },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <FeedList
        key={scope}
        scope={scope}
        header={header}
        empty={
          scope === 'home' ? (
            <EmptyState
              icon="people-outline"
              title="Your feed is waiting"
              message="Posts from you and your friends appear here. Find people who share your interests, or see what’s happening across Africa."
              actionLabel="Find people"
              onAction={() => router.push('/discover')}
            />
          ) : (
            <EmptyState icon="earth-outline" title="Nothing here yet" message="Be the first to share something with everyone." />
          )
        }
      />
    </View>
  );
}

function Composer({ name, avatar, id }: { name?: string; avatar?: string | null; id?: string }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/compose')}
      accessibilityRole="button"
      accessibilityLabel="Create a post"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.9 : 1,
      })}>
      <Avatar path={avatar} name={name} seed={id} size={40} />
      <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text color="textMuted">What’s happening{name ? `, ${name.split(' ')[0]}` : ''}?</Text>
      </View>
      <Ionicons name="image-outline" size={24} color={colors.primary} />
    </Pressable>
  );
}

function QuickLinks() {
  const { colors, radii } = useTheme();
  const links: { label: string; icon: ComponentProps<typeof Ionicons>['name']; href: '/meetups' | '/dating' | '/friends'; tint: string }[] = [
    { label: 'Meetups', icon: 'cafe-outline', href: '/meetups', tint: colors.accent },
    { label: 'Friends', icon: 'people-outline', href: '/friends', tint: colors.brand },
    { label: 'Dating', icon: 'heart-outline', href: '/dating', tint: colors.danger },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {links.map((l) => (
        <Pressable
          key={l.label}
          onPress={() => router.push(l.href)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons name={l.icon} size={18} color={l.tint} />
          <Text variant="small" style={{ fontWeight: '700' }}>
            {l.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
