import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner, Button, Screen, Stack, Text, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';

const RESEND_COOLDOWN = 60;

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { verifyEmailCode, resendVerification } = useAuth();
  const [email] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, code);
      // The root navigator moves on to onboarding once the session exists.
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await resendVerification(email);
      setInfo('We sent a new code. It can take a minute to arrive — check spam too.');
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={20}>
        <Stack gap={6}>
          <Text variant="title" accessibilityRole="header">
            Check your email
          </Text>
          <Text color="textMuted">
            We sent a 6-digit code to <Text variant="bodyStrong">{email || 'your email'}</Text>. Enter it below, or tap the
            link in the email.
          </Text>
        </Stack>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {info ? <Banner>{info}</Banner> : null}
        <TextField
          label="Verification code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          style={{ fontSize: 24, letterSpacing: 8 }}
          testID="verify-code"
        />
        <Button title="Verify email" onPress={verify} loading={busy} size="lg" fullWidth testID="verify-submit" />
        <Button
          title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          variant="ghost"
          onPress={resend}
          disabled={cooldown > 0 || !email}
        />
        <Button title="Use a different email" variant="ghost" onPress={() => router.replace('/sign-up')} />
      </Stack>
    </Screen>
  );
}
