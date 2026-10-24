import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, LoadingState, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/**
 * Landing route for links in auth emails (deep link on mobile, URL on web).
 * Supports PKCE `code` and `token_hash` links. Users can also type the
 * 6-digit code from the email instead of opening the link.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string; error_description?: string }>();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (params.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(params.code);
          if (e) throw e;
        } else if (params.token_hash && params.type) {
          const { error: e } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: params.type as 'signup' | 'recovery' | 'email_change' | 'email',
          });
          if (e) throw e;
        }
        if (!cancelled) router.replace('/');
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'This link has expired. Request a new one or enter the code from the email.'));
      }
    }
    if (!params.error_description) run();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.token_hash, params.type, params.error_description]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 16 }}>
      {error ? (
        <>
          <Text align="center">{error}</Text>
          <Button title="Continue" onPress={() => router.replace('/')} />
        </>
      ) : (
        <LoadingState label="Signing you in…" />
      )}
    </View>
  );
}
