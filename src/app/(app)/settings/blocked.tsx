import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PersonRow } from '@/components/PersonRow';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { listBlockedUsers, unblockUser } from '@/lib/api';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';

export default function Blocked() {
  const queryClient = useQueryClient();
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: listBlockedUsers });
  const unblock = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => notify('Could not unblock', friendlyError(e)),
  });
  if (blocked.isLoading) return <LoadingState />;
  if (blocked.isError) return <ErrorState message={friendlyError(blocked.error)} onRetry={() => blocked.refetch()} />;
  return (
    <Screen edges={['left', 'right']}>
      {!blocked.data?.length ? (
        <EmptyState icon="ban-outline" title="No one is blocked" message="Blocked members can’t see your profile or posts, or message you." />
      ) : (
        blocked.data.map((b) => (
          <PersonRow
            key={b.id}
            person={b}
            onPress={() => undefined}
            right={
              <Button
                title="Unblock"
                size="sm"
                variant="secondary"
                onPress={async () => {
                  if (await confirm(`Unblock @${b.username}?`, 'You’ll be able to see each other again. You won’t automatically become friends.', 'Unblock')) {
                    unblock.mutate(b.id);
                  }
                }}
              />
            }
          />
        ))
      )}
    </Screen>
  );
}
