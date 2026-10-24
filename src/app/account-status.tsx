import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Banner, Button, Card, Screen, Stack, Text, TextField } from '@/components/ui';
import { listMyAppeals, listMyModerationActions, reactivateAccount, submitAppeal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** Shown when the account cannot use the app: under 18, deactivated, suspended or banned. */
export default function AccountStatus() {
  const { account, refreshAccount, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const reactivate = useMutation({
    mutationFn: reactivateAccount,
    onSuccess: () => refreshAccount(),
    onError: (e) => setError(friendlyError(e)),
  });

  let title = 'Your account is unavailable';
  let body = 'Please contact support for help.';
  if (account?.age_gate_failed) {
    title = 'Patapata is for adults';
    body =
      'Patapata is only available to people aged 18 and over, so we can’t create a profile for you. If you entered your date of birth by mistake, contact support.';
  } else if (account?.status === 'deactivated') {
    title = account.deletion_requested_at ? 'Your account is scheduled for deletion' : 'Your account is deactivated';
    body = account.deletion_scheduled_for && account.deletion_requested_at
      ? `Your account and content will be permanently deleted on ${formatDateTime(account.deletion_scheduled_for)}. You can still change your mind.`
      : 'Your profile is hidden. Reactivate any time to pick up where you left off.';
  } else if (account?.status === 'suspended') {
    title = 'Your account is temporarily suspended';
    body = `This is because of a breach of our Community Guidelines. You can use Patapata again from ${formatDateTime(
      account.suspended_until,
    )}. If you think we got it wrong, you can appeal below.`;
  } else if (account?.status === 'banned') {
    title = 'Your account has been banned';
    body = 'This is because of serious or repeated breaches of our Community Guidelines. You can appeal below.';
  }

  const canAppeal = account?.status === 'suspended' || account?.status === 'banned';

  return (
    <Screen>
      <Stack gap={20} style={{ marginTop: 24 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <Text color="textMuted">{body}</Text>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {account?.status === 'deactivated' ? (
          <Button title="Reactivate my account" size="lg" onPress={() => reactivate.mutate()} loading={reactivate.isPending} />
        ) : null}
        {canAppeal ? <AppealSection /> : null}
        {config.supportEmail ? <Text color="textMuted">Support: {config.supportEmail}</Text> : null}
        <Button title="Sign out" variant="secondary" onPress={signOut} />
      </Stack>
    </Screen>
  );
}

function AppealSection() {
  const actions = useQuery({ queryKey: ['my-moderation-actions'], queryFn: listMyModerationActions });
  const appeals = useQuery({ queryKey: ['my-appeals'], queryFn: listMyAppeals });
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = (actions.data ?? []).find((a) => a.action === 'suspend' || a.action === 'ban');
  const existing = (appeals.data ?? []).find((a) => a.moderation_action_id === latest?.id);

  const submit = useMutation({
    mutationFn: () => submitAppeal(latest!.id, message.trim()),
    onSuccess: () => {
      setDone(true);
      appeals.refetch();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  if (!latest) return null;
  return (
    <Card>
      <Stack gap={12}>
        <Text variant="heading">Appeal this decision</Text>
        <Text variant="small" color="textMuted">
          Reason given: {latest.reason}
        </Text>
        {existing || done ? (
          <Banner>
            {existing?.status === 'open' || done
              ? 'Your appeal is with an independent moderator. We’ll notify you of the outcome.'
              : `Appeal ${existing?.status}. ${existing?.decision_note ?? ''}`}
          </Banner>
        ) : (
          <>
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <TextField
              label="Tell us why this decision should be reviewed"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
              maxLengthCounter
            />
            <Button
              title="Submit appeal"
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={message.trim().length < 10}
            />
          </>
        )}
      </Stack>
    </Card>
  );
}
