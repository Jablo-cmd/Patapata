import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { PersonRow } from '@/components/PersonRow';
import { Button, EmptyState, ErrorState, LoadingState, Row, Screen } from '@/components/ui';
import { getOrCreateConversation, listDatingMatches, unmatch } from '@/lib/api';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';

export default function Matches() {
  const queryClient = useQueryClient();
  const matches = useQuery({ queryKey: ['dating-matches'], queryFn: listDatingMatches });
  const message = useMutation({
    mutationFn: getOrCreateConversation,
    onSuccess: (id) => router.push(`/chat/${id}`),
    onError: (e) => notify('Could not open chat', friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: unmatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dating-matches'] }),
    onError: (e) => notify('Could not unmatch', friendlyError(e)),
  });

  if (matches.isLoading) return <LoadingState />;
  if (matches.isError) return <ErrorState message={friendlyError(matches.error)} onRetry={() => matches.refetch()} />;
  return (
    <Screen edges={['left', 'right']}>
      {!matches.data?.length ? (
        <EmptyState icon="heart-outline" title="No matches yet" message="When someone you liked likes you back, they’ll appear here." />
      ) : (
        matches.data.map((m) => (
          <PersonRow
            key={m.match_id}
            person={{ id: m.user_id, username: m.username, display_name: m.display_name, avatar_path: m.avatar_path }}
            subtitle={`Matched ${relativeTime(m.matched_at)}`}
            right={
              <Row gap={4}>
                <Button title="Message" size="sm" onPress={() => message.mutate(m.user_id)} />
                <Button
                  title="Unmatch"
                  size="sm"
                  variant="ghost"
                  onPress={async () => {
                    if (await confirm('Unmatch?', `You and ${m.display_name} will no longer be matched.`, 'Unmatch', true)) remove.mutate(m.user_id);
                  }}
                />
              </Row>
            }
          />
        ))
      )}
    </Screen>
  );
}
