import { Link, router } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Screen, Stack, Text, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorCode, friendlyError } from '@/lib/errors';
import { validateEmail } from '@/lib/validation';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const emailError = validateEmail(email);
    if (emailError || !password) {
      setError(emailError ?? 'Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      await signIn(email, password);
    } catch (e) {
      setUnverified(errorCode(e) === 'email_not_confirmed');
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={20}>
        <Text variant="title" accessibilityRole="header">
          Welcome back
        </Text>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {unverified ? (
          <Button
            title="Enter verification code"
            variant="secondary"
            onPress={() => router.push({ pathname: '/verify', params: { email: email.trim() } })}
          />
        ) : null}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          testID="sign-in-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          testID="sign-in-password"
        />
        <Button title="Sign in" onPress={submit} loading={busy} size="lg" fullWidth testID="sign-in-submit" />
        <Link href="/forgot-password" style={{ alignSelf: 'center', padding: 8 }}>
          <Text color="primary" variant="bodyStrong">
            Forgot your password?
          </Text>
        </Link>
        <Text align="center" color="textMuted">
          New to Patapata?{' '}
          <Link href="/sign-up" replace>
            <Text color="primary" variant="bodyStrong">
              Create an account
            </Text>
          </Link>
        </Text>
      </Stack>
    </Screen>
  );
}
