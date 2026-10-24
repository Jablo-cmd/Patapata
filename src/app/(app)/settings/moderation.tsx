import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen, Stack, Text, TextField } from '@/components/ui';
import { listMyAppeals, listMyModerationActions, submitAppeal } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

const ACTION_LABEL: Record<string, string> = {
  remove_content: 'Content removed',
  restore_content: 'Content restored',
  warn: 'Warning',
  suspend: 'Temporary suspension',
  ban: 'Account banned',
  reinstate: 'Account reinstated',
};
const APPEALABLE = ['remove_content', 'warn', 'suspend', 'ban'];

export default function MyModeration() {
  const queryClient = useQueryClient();
  const actions = useQuery({ queryKey: ['my-moderation-actions'], queryFn: listMyModerationActions });
  const appeals = useQuery({ queryKey: ['my-appeals'], queryFn: listMyAppeals });
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => submitAppeal(id, text),
    onSuccess: () => {
      setOpen(null);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['my-appeals'] });
    },
    onError: (e) => setError(friendlyError(e)),
  });

  if (actions.isLoading) return <LoadingState />;
  if (actions.isError) return <ErrorState message={friendlyError(actions.error)} onRetry={() => actions.refetch()} />;
  const list = (actions.data ?? []).filter((a) => ACTION_LABEL[a.action]);

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={12}>
        <Text color="textMuted">
          If a moderator acts on your account or content, you’ll see it here with the reason. You can appeal once per decision;
          appeals are reviewed by a different moderator.
        </Text>
        {!list.length ? <EmptyState icon="shield-checkmark-outline" title="Nothing here" message="Your account is in good standing." /> : null}
        {list.map((a) => {
          const appeal = appeals.data?.find((x) => x.moderation_action_id === a.id);
          return (
            <Card key={a.id}>
              <Stack gap={8}>
                <Text variant="heading">{ACTION_LABEL[a.action]}</Text>
                <Text variant="small" color="textMuted">
                  {formatDateTime(a.created_at)}
                  {a.expires_at ? ` · until ${formatDateTime(a.expires_at)}` : ''}
                </Text>
                <Text>Reason: {a.reason}</Text>
                {appeal ? (
                  <Banner>
                    {appeal.status === 'open'
                      ? 'Appeal under review.'
                      : `Appeal ${appeal.status === 'overturned' ? 'accepted' : 'reviewed — decision upheld'}. ${appeal.decision_note ?? ''}`}
                  </Banner>
                ) : APPEALABLE.includes(a.action) ? (
                  open === a.id ? (
                    <Stack gap={8}>
                      {error ? <Banner tone="danger">{error}</Banner> : null}
                      <TextField label="Why should this be reviewed?" value={message} onChangeText={setMessage} multiline maxLength={2000} />
                      <Button title="Submit appeal" disabled={message.trim().length < 10} loading={submit.isPending} onPress={() => submit.mutate({ id: a.id, text: message.trim() })} />
                    </Stack>
                  ) : (
                    <Button title="Appeal" variant="secondary" size="sm" onPress={() => setOpen(a.id)} style={{ alignSelf: 'flex-start' }} />
                  )
                ) : null}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Screen>
  );
}
