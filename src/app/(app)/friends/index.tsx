import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { PersonRow } from '@/components/PersonRow';
import { Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, SegmentedControl, SectionTitle, Stack } from '@/components/ui';
import { cancelFriendRequest, listFriendRequests, listFriends, respondFriendRequest, sendFriendRequest, suggestPeople } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';

type Tab = 'requests' | 'friends' | 'suggestions';

export default function Friends() {
  const [tab, setTab] = useState<Tab>('requests');
  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={16}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'requests', label: 'Requests' },
            { value: 'friends', label: 'Friends' },
            { value: 'suggestions', label: 'Suggestions' },
          ]}
        />
        {tab === 'requests' ? <Requests /> : tab === 'friends' ? <MyFriends /> : <Suggestions />}
      </Stack>
    </Screen>
  );
}

function Requests() {
  const me = useUserId();
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ['friend-requests'], queryFn: listFriendRequests });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['friends'] });
  };
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondFriendRequest(id, accept),
    onSuccess: refresh,
    onError: (e) => notify('Could not respond', friendlyError(e)),
  });
  const cancel = useMutation({ mutationFn: cancelFriendRequest, onSuccess: refresh, onError: (e) => notify('Could not cancel', friendlyError(e)) });

  if (requests.isLoading) return <LoadingState />;
  if (requests.isError) return <ErrorState message={friendlyError(requests.error)} onRetry={() => requests.refetch()} />;
  const incoming = (requests.data ?? []).filter((r) => r.addressee_id === me && r.requester);
  const outgoing = (requests.data ?? []).filter((r) => r.requester_id === me && r.addressee);
  if (!incoming.length && !outgoing.length) {
    return <EmptyState icon="mail-open-outline" title="No pending requests" message="When someone wants to connect, you’ll see it here." />;
  }
  return (
    <Stack gap={12}>
      {incoming.length ? <SectionTitle title={`Received (${incoming.length})`} /> : null}
      {incoming.map((r) => (
        <Card key={r.id}>
          <PersonRow person={r.requester!} subtitle={`@${r.requester!.username} · ${relativeTime(r.created_at)}`} />
          <Row gap={8} style={{ marginTop: 8 }}>
            <Button title="Accept" size="sm" icon="checkmark" onPress={() => respond.mutate({ id: r.requester_id, accept: true })} />
            <Button title="Decline" size="sm" variant="secondary" onPress={() => respond.mutate({ id: r.requester_id, accept: false })} />
          </Row>
        </Card>
      ))}
      {outgoing.length ? <SectionTitle title={`Sent (${outgoing.length})`} /> : null}
      {outgoing.map((r) => (
        <Card key={r.id}>
          <PersonRow
            person={r.addressee!}
            subtitle={`Sent ${relativeTime(r.created_at)}`}
            right={<Button title="Cancel" size="sm" variant="secondary" onPress={() => cancel.mutate(r.addressee_id)} />}
          />
        </Card>
      ))}
    </Stack>
  );
}

function MyFriends() {
  const me = useUserId();
  const friends = useQuery({ queryKey: ['friends', me], queryFn: () => listFriends(me) });
  if (friends.isLoading) return <LoadingState />;
  if (friends.isError) return <ErrorState message={friendlyError(friends.error)} onRetry={() => friends.refetch()} />;
  if (!friends.data?.length) {
    return <EmptyState icon="people-outline" title="No friends yet" message="Check Suggestions or Discover to find people you’ll get along with." />;
  }
  return (
    <View>
      {friends.data.map((f) => (
        <PersonRow key={f.id} person={f} />
      ))}
    </View>
  );
}

export function Suggestions() {
  const queryClient = useQueryClient();
  const suggestions = useQuery({ queryKey: ['suggestions'], queryFn: () => suggestPeople(20) });
  const [sent, setSent] = useState<Set<string>>(new Set());
  const add = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (_s, id) => {
      setSent((cur) => new Set(cur).add(id));
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (e) => notify('Could not send request', friendlyError(e)),
  });
  if (suggestions.isLoading) return <LoadingState />;
  if (suggestions.isError) return <ErrorState message={friendlyError(suggestions.error)} onRetry={() => suggestions.refetch()} />;
  if (!suggestions.data?.length) {
    return <EmptyState icon="sparkles-outline" title="No suggestions yet" message="Add interests to your profile and we’ll suggest people who share them." />;
  }
  const reason = (s: { reason: string; mutual_friends: number; shared_interests: number }) =>
    s.reason === 'mutual_friends'
      ? `${s.mutual_friends} mutual friend${s.mutual_friends === 1 ? '' : 's'}`
      : s.reason === 'shared_interests'
        ? `${s.shared_interests} shared interest${s.shared_interests === 1 ? '' : 's'}`
        : s.reason === 'same_city'
          ? 'Near you'
          : 'In your country';
  return (
    <View>
      {suggestions.data.map((s) => (
        <PersonRow
          key={s.id}
          person={s}
          subtitle={reason(s)}
          right={
            sent.has(s.id) ? (
              <Button title="Sent" size="sm" variant="secondary" disabled />
            ) : (
              <Button title="Add" size="sm" icon="person-add-outline" onPress={() => add.mutate(s.id)} />
            )
          }
        />
      ))}
    </View>
  );
}
