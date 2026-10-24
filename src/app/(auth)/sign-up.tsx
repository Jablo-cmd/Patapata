import { Link, router } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Checkbox, Screen, Stack, Text, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { validateEmail, validatePassword } from '@/lib/validation';

export default function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; adult?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
      adult: adult ? null : 'Patapata is only for adults aged 18 and over.',
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password || next.adult) return;
    setBusy(true);
    try {
      const { needsVerification } = await signUp(email, password);
      if (needsVerification) {
        router.replace({ pathname: '/verify', params: { email: email.trim() } });
      }
    } catch (e) {
      setFormError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={20}>
        <Stack gap={6}>
          <Text variant="title" accessibilityRole="header">
            Join Patapata
          </Text>
          <Text color="textMuted">It’s free, and always will be. We’ll email you a code to confirm it’s you.</Text>
        </Stack>
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          testID="sign-up-email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoComplete="new-password"
          textContentType="newPassword"
          hint="At least 10 characters, with letters and numbers."
          error={errors.password}
          testID="sign-up-password"
        />
        <Checkbox checked={adult} onChange={setAdult} testID="sign-up-adult">
          I am 18 or older and agree to the Terms, Community Guidelines and Privacy Policy.
        </Checkbox>
        {errors.adult ? (
          <Text variant="small" color="danger">
            {errors.adult}
          </Text>
        ) : null}
        <Button title="Create account" onPress={submit} loading={busy} size="lg" fullWidth testID="sign-up-submit" />
        <Text align="center" color="textMuted">
          Already a member?{' '}
          <Link href="/sign-in" replace>
            <Text color="primary" variant="bodyStrong">
              Sign in
            </Text>
          </Link>
        </Text>
      </Stack>
    </Screen>
  );
}
