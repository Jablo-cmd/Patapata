import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Brand, Text } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/config';
import { isNetworkError } from '@/lib/errors';
import { palette, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => count < 2 && isNetworkError(error),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemedRoot />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function ThemedRoot() {
  const theme = useTheme();
  const navTheme = theme.dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.accent,
        },
      }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <RootNavigator />
    </ThemeProvider>
  );
}

type Gate = 'loading' | 'signed-out' | 'onboarding' | 'restricted' | 'active';

function useGate(): Gate {
  const { initializing, session, account, accountLoading } = useAuth();
  if (initializing) return 'loading';
  if (!session) return 'signed-out';
  if (accountLoading || account === undefined) return 'loading';
  if (!account) return 'restricted';
  if (account.age_gate_failed) return 'restricted';
  if (account.status === 'pending') return 'onboarding';
  if (account.status === 'active') return 'active';
  if (account.status === 'suspended' && account.suspended_until && new Date(account.suspended_until) <= new Date()) {
    return 'active';
  }
  return 'restricted';
}

function RootNavigator() {
  const gate = useGate();
  const { colors } = useTheme();

  useEffect(() => {
    if (gate !== 'loading' || !isConfigured) SplashScreen.hideAsync().catch(() => undefined);
  }, [gate]);

  if (!isConfigured) return <NotConfigured />;
  if (gate === 'loading') {
    return <View style={{ flex: 1, backgroundColor: palette.navy800 }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Protected guard={gate === 'signed-out'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'onboarding'}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'restricted'}>
        <Stack.Screen name="account-status" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'active'}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
    </Stack>
  );
}

function NotConfigured() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.navy800, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Brand size={30} />
      <Text style={{ color: '#FFFFFF' }} align="center">
        Patapata is not configured yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see README.md),
        then restart the app.
      </Text>
    </View>
  );
}
