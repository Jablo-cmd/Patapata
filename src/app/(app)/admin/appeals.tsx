import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, Stack, Text, TextField } from '@/components/ui';
import { admin } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

export default function Appeals() {
  const queryClient = useQueryClient();
  const appeals = useQuery({ queryKey: ['admin', 'appeals'], queryFn: admin.listAppeals });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: ({ id, overturn }: { id: string; overturn: boolean }) => admin.decideAppeal(id, overturn, (notes[id] ?? '').trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => setError(friendlyError(e)),
  });

  if (appeals.isLoading) return <LoadingState />;
  if (appeals.isError) return <ErrorState message={friendlyError(appeals.error)} onRetry={() => appeals.refetch()} />;
  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={12}>
        <Text color="textMuted">Appeals must be decided by someone other than the moderator who made the original decision.</Text>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {!appeals.data?.length ? <EmptyState icon="checkmark-done-outline" title="No open appeals" /> : null}
        {(appeals.data ?? []).map((a) => (
          <Card key={a.id}>
            <Stack gap={8}>
              <Text variant="bodyStrong">
                @{a.username ?? 'deleted'} appeals: {a.action.replace('_', ' ')}
              </Text>
              <Text variant="small" color="textMuted">
                Original reason: {a.action_reason} ({formatDateTime(a.action_created_at)})
              </Text>
              <Text>“{a.message}”</Text>
              <TextField label="Decision note (shown to the member)" value={notes[a.id] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [a.id]: t }))} multiline />
              <Row gap={8} wrap>
                <Button title="Overturn" size="sm" onPress={() => decide.mutate({ id: a.id, overturn: true })} />
                <Button title="Uphold" size="sm" variant="secondary" onPress={() => decide.mutate({ id: a.id, overturn: false })} />
              </Row>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
