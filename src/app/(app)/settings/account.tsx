import { useState } from 'react';

import { Banner, Button, Card, Screen, Stack, Text, TextField } from '@/components/ui';
import { deactivateAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword } from '@/lib/validation';

export default function Account() {
  const { email, updatePassword, refreshAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'info', text: success });
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        <Card>
          <Stack gap={12}>
            <Text variant="heading">Change password</Text>
            <TextField label="New password" value={password} onChangeText={setPassword} secureToggle autoComplete="new-password" hint="At least 10 characters, with letters and numbers." />
            <Button
              title="Update password"
              loading={busy === 'password'}
              onPress={() => {
                const err = validatePassword(password);
                if (err) return setMessage({ tone: 'danger', text: err });
                run('password', async () => {
                  await updatePassword(password);
                  setPassword('');
                }, 'Password updated.');
              }}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap={12}>
            <Text variant="heading">Email address</Text>
            <Text color="textMuted">Currently {email}</Text>
            <TextField label="New email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
            <Button
              title="Change email"
              variant="secondary"
              loading={busy === 'email'}
              onPress={() => {
                const err = validateEmail(newEmail);
                if (err) return setMessage({ tone: 'danger', text: err });
                run('email', async () => {
                  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
                  if (error) throw error;
                }, 'Check both your old and new inbox to confirm the change.');
              }}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap={12}>
            <Text variant="heading">Take a break</Text>
            <Text color="textMuted">Deactivating hides your profile, posts and dating profile until you sign back in and reactivate.</Text>
            <Button
              title="Deactivate account"
              variant="secondary"
              loading={busy === 'deactivate'}
              onPress={async () => {
                if (!(await confirm('Deactivate your account?', 'Your profile will be hidden until you reactivate.', 'Deactivate', true))) return;
                run('deactivate', async () => {
                  await deactivateAccount(false);
                  await refreshAccount();
                }, 'Account deactivated.');
              }}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap={12}>
            <Text variant="heading" color="danger">
              Delete account
            </Text>
            <Text color="textMuted">
              Your profile is hidden immediately. After 14 days your account, posts, comments, messages, photos and dating data
              are permanently deleted. You can cancel by signing in during those 14 days.
            </Text>
            <TextField label='Type "DELETE" to confirm' value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
            <Button
              title="Delete my account"
              variant="danger"
              disabled={confirmText.trim() !== 'DELETE'}
              loading={busy === 'delete'}
              onPress={() =>
                run('delete', async () => {
                  await deactivateAccount(true);
                  await refreshAccount();
                }, 'Deletion scheduled.')
              }
            />
          </Stack>
        </Card>
      </Stack>
    </Screen>
  );
}
