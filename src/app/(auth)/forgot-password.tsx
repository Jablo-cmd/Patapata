import { useState } from 'react';

import { Banner, Button, Screen, Stack, Text, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { validateEmail, validatePassword } from '@/lib/validation';

/**
 * Two steps on one screen: request a code, then enter the code together with
 * the new password. Verifying the code signs the member in, so both actions
 * run back to back before the navigator moves on.
 */
export default function ForgotPassword() {
  const { requestPasswordReset, verifyRecoveryCode, updatePassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setStep('code');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const passwordError = validatePassword(password);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyRecoveryCode(email, code);
      await updatePassword(password);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={20}>
        <Stack gap={6}>
          <Text variant="title" accessibilityRole="header">
            Reset your password
          </Text>
          <Text color="textMuted">
            {step === 'email'
              ? 'Enter the email you signed up with and we’ll send you a code.'
              : `If an account exists for ${email.trim()}, we sent it a 6-digit code.`}
          </Text>
        </Stack>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {step === 'email' ? (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Button title="Send code" onPress={sendCode} loading={busy} size="lg" fullWidth />
          </>
        ) : (
          <>
            <TextField
              label="Code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
            />
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureToggle
              autoComplete="new-password"
              hint="At least 10 characters, with letters and numbers."
            />
            <Button title="Set new password" onPress={reset} loading={busy} size="lg" fullWidth />
            <Button title="Send a new code" variant="ghost" onPress={sendCode} />
          </>
        )}
      </Stack>
    </Screen>
  );
}
