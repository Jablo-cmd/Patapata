import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Banner, Button, Card, Divider, ErrorState, LoadingState, OptionPicker, Screen, Stack, Text, ToggleRow } from '@/components/ui';
import { clearLocation, getPrivacySettings, updatePrivacySettings } from '@/lib/api';
import { notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import type { PrivacySettings } from '@/lib/types';

export default function Privacy() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['privacy'], queryFn: getPrivacySettings });
  const update = useMutation({
    mutationFn: updatePrivacySettings,
    onMutate: async (patch) => {
      queryClient.setQueryData<PrivacySettings>(['privacy'], (cur) => (cur ? { ...cur, ...patch } : cur));
    },
    onError: (e) => {
      notify('Could not save', friendlyError(e));
      settings.refetch();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
  const clear = useMutation({
    mutationFn: clearLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['privacy'] }),
    onError: (e) => notify('Could not clear location', friendlyError(e)),
  });

  if (settings.isLoading) return <LoadingState />;
  if (settings.isError || !settings.data) return <ErrorState message={friendlyError(settings.error)} onRetry={() => settings.refetch()} />;
  const s = settings.data;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Card>
          <Stack gap={14}>
            <OptionPicker
              label="Who can see your full profile"
              searchable={false}
              value={s.profile_visibility}
              onChange={(v) => v && update.mutate({ profile_visibility: v })}
              options={[
                { value: 'members', label: 'All Patapata members' },
                { value: 'friends', label: 'Friends only', description: 'Others see your name, photo and country only' },
              ]}
            />
            <OptionPicker
              label="Who can see your friends list"
              searchable={false}
              value={s.friends_list_visibility}
              onChange={(v) => v && update.mutate({ friends_list_visibility: v })}
              options={[
                { value: 'members', label: 'All members' },
                { value: 'friends', label: 'Friends' },
                { value: 'only_me', label: 'Only me' },
              ]}
            />
            <OptionPicker
              label="Who can send you friend requests"
              searchable={false}
              value={s.friend_requests_from}
              onChange={(v) => v && update.mutate({ friend_requests_from: v })}
              options={[
                { value: 'everyone', label: 'Everyone' },
                { value: 'nobody', label: 'Nobody' },
              ]}
            />
            <OptionPicker
              label="Who can message you"
              searchable={false}
              value={s.messages_from}
              onChange={(v) => v && update.mutate({ messages_from: v })}
              options={[
                { value: 'everyone', label: 'Everyone' },
                { value: 'friends', label: 'Friends and dating matches' },
                { value: 'nobody', label: 'Nobody new', description: 'Existing conversations where they replied continue' },
              ]}
            />
          </Stack>
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          <ToggleRow title="Appear in Discover and search" value={s.discoverable} onChange={(discoverable) => update.mutate({ discoverable })} />
          <Divider />
          <ToggleRow title="Show my age" subtitle="Your date of birth is never shown" value={s.show_age} onChange={(show_age) => update.mutate({ show_age })} />
          <Divider />
          <ToggleRow title="Show my city and region" value={s.show_city} onChange={(show_city) => update.mutate({ show_city })} />
        </Card>
        <Card>
          <Stack gap={10}>
            <Text variant="heading">Approximate location</Text>
            {s.location_enabled ? (
              <>
                <Text color="textMuted">
                  On. We store a location rounded to about 1 km and show others only a distance band, like “10–25 km”.
                </Text>
                <Button title="Turn off and delete my location" variant="secondary" onPress={() => clear.mutate()} loading={clear.isPending} />
              </>
            ) : (
              <Text color="textMuted">Off. You can turn it on from the Discover filters to see rough distances.</Text>
            )}
          </Stack>
        </Card>
        <Banner>Your email address and date of birth are never shown to other members.</Banner>
      </Stack>
    </Screen>
  );
}
