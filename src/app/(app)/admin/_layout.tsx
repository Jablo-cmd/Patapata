import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

/**
 * Moderator area. This guard only hides the UI: every admin RPC checks the
 * staff role in the database, so a non-staff member gets "staff_only" errors
 * even if they reach these routes.
 */
export default function AdminLayout() {
  const { account } = useAuth();
  const { colors } = useTheme();
  if (!account?.staff_role) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Moderation dashboard' }} />
      <Stack.Screen name="reports" options={{ title: 'Report queue' }} />
      <Stack.Screen name="report/[id]" options={{ title: 'Review report' }} />
      <Stack.Screen name="appeals" options={{ title: 'Appeals' }} />
      <Stack.Screen name="users" options={{ title: 'Members' }} />
    </Stack>
  );
}
