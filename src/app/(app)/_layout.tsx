import { Stack } from 'expo-router';

import { useBadgeSubscription } from '@/lib/hooks';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();
  useBadgeSubscription();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="compose" options={{ presentation: 'modal', title: 'Create post' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Report' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="user/[username]" options={{ title: '' }} />
      <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="friends/index" options={{ title: 'Friends' }} />
      <Stack.Screen name="friends/[userId]" options={{ title: 'Friends' }} />
      <Stack.Screen name="meetups/index" options={{ title: 'Meetups & chill' }} />
      <Stack.Screen name="meetups/new" options={{ title: 'New invitation', presentation: 'modal' }} />
      <Stack.Screen name="meetups/[id]" options={{ title: '' }} />
      <Stack.Screen name="dating/index" options={{ title: 'Dating' }} />
      <Stack.Screen name="dating/setup" options={{ title: 'Dating settings' }} />
      <Stack.Screen name="dating/matches" options={{ title: 'Matches' }} />
      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Stack.Screen name="settings/profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="settings/privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="settings/blocked" options={{ title: 'Blocked members' }} />
      <Stack.Screen name="settings/account" options={{ title: 'Account' }} />
      <Stack.Screen name="settings/moderation" options={{ title: 'Moderation & appeals' }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}
