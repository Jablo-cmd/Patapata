import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { PersonRow } from '@/components/PersonRow';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { listFriends } from '@/lib/api';
import { friendlyError } from '@/lib/errors';

export default function UserFriends() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const friends = useQuery({ queryKey: ['friends', userId], queryFn: () => listFriends(userId) });
  if (friends.isLoading) return <LoadingState />;
  if (friends.isError) return <ErrorState message={friendlyError(friends.error)} onRetry={() => friends.refetch()} />;
  return (
    <Screen edges={['left', 'right']}>
      {friends.data?.length ? (
        friends.data.map((f) => <PersonRow key={f.id} person={f} />)
      ) : (
        <EmptyState icon="lock-closed-outline" title="Friends list not available" message="This member keeps their friends list private, or has no friends to show yet." />
      )}
    </Screen>
  );
}
