import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Banner, Card, Divider, ErrorState, LoadingState, Screen, Stack, ToggleRow } from '@/components/ui';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import type { NotificationPreferences } from '@/lib/types';

const ROWS: { key: keyof Omit<NotificationPreferences, 'user_id' | 'updated_at'>; title: string; subtitle?: string }[] = [
  { key: 'friend_requests', title: 'Friend requests' },
  { key: 'likes', title: 'Likes and shares' },
  { key: 'comments', title: 'Comments and replies' },
  { key: 'mentions', title: 'Mentions' },
  { key: 'messages', title: 'New messages' },
  { key: 'meetups', title: 'Meetup responses and changes' },
  { key: 'dating', title: 'Dating matches' },
  { key: 'push_enabled', title: 'Push notifications', subtitle: 'Applies once push is available in the app' },
];

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: getNotificationPreferences });
  const update = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: (patch) => queryClient.setQueryData<NotificationPreferences>(['notification-prefs'], (cur) => (cur ? { ...cur, ...patch } : cur)),
    onError: (e) => {
      notify('Could not save', friendlyError(e));
      prefs.refetch();
    },
  });
  if (prefs.isLoading) return <LoadingState />;
  if (prefs.isError || !prefs.data) return <ErrorState message={friendlyError(prefs.error)} onRetry={() => prefs.refetch()} />;
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Card style={{ paddingVertical: 4 }}>
          {ROWS.map((r, i) => (
            <Stack key={r.key} gap={0}>
              {i > 0 ? <Divider /> : null}
              <ToggleRow title={r.title} subtitle={r.subtitle} value={prefs.data[r.key] as boolean} onChange={(v) => update.mutate({ [r.key]: v })} />
            </Stack>
          ))}
        </Card>
        <Banner>Security alerts (like password changes) and moderation notices are always on.</Banner>
      </Stack>
    </Screen>
  );
}
