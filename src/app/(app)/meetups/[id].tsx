import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack as RouterStack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { PersonRow } from '@/components/PersonRow';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, SectionTitle, Stack, Text } from '@/components/ui';
import { getMeetup, leaveMeetup, listMeetupAttendees, respondToMeetup, updateMeetup } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { categoryLabel } from '@/lib/constants';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useCountries } from '@/lib/hooks';
import type { MeetupResponse } from '@/lib/types';
import { useTheme } from '@/theme';

export default function MeetupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { byCode } = useCountries();
  const meetup = useQuery({ queryKey: ['meetup', id], queryFn: () => getMeetup(id) });
  const attendees = useQuery({ queryKey: ['meetup-attendees', id], queryFn: () => listMeetupAttendees(id), enabled: Boolean(meetup.data) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['meetup', id] });
    queryClient.invalidateQueries({ queryKey: ['meetup-attendees', id] });
    queryClient.invalidateQueries({ queryKey: ['meetups'] });
  };
  const onError = (e: unknown) => notify('Something went wrong', friendlyError(e));
  const respond = useMutation({ mutationFn: (s: MeetupResponse) => respondToMeetup(id, s), onSuccess: refresh, onError });
  const leave = useMutation({ mutationFn: () => leaveMeetup(id), onSuccess: refresh, onError });
  const cancel = useMutation({ mutationFn: () => updateMeetup(id, { status: 'cancelled' }), onSuccess: refresh, onError });

  if (meetup.isLoading) return <LoadingState />;
  if (meetup.isError) return <ErrorState message={friendlyError(meetup.error)} onRetry={() => meetup.refetch()} />;
  const m = meetup.data;
  if (!m) return <EmptyState icon="calendar-outline" title="Meetup unavailable" message="It may have been removed, or you may not have access." />;

  const isHost = m.host_id === me;
  const cat = categoryLabel(m.category);
  const country = byCode.get(m.country_code);
  const open = m.status === 'scheduled';
  const going = (attendees.data ?? []).filter((a) => a.status === 'going');
  const interested = (attendees.data ?? []).filter((a) => a.status === 'interested');

  return (
    <Screen edges={['left', 'right', 'bottom']} refreshing={meetup.isRefetching} onRefresh={refresh}>
      <RouterStack.Screen options={{ title: cat?.label ?? 'Meetup' }} />
      <Stack gap={16}>
        {m.status === 'cancelled' ? <Banner tone="danger">This meetup was cancelled by the host.</Banner> : null}
        <Text variant="caption" color="textMuted">
          {cat?.emoji} {m.kind === 'chill' ? 'CHILL INVITE' : 'MEETUP'} · {m.audience === 'friends' ? 'FRIENDS ONLY' : 'OPEN TO EVERYONE'}
        </Text>
        <Text variant="title">{m.title}</Text>
        <PersonRow person={{ id: m.host_id, username: m.host_username, display_name: m.host_display_name, avatar_path: m.host_avatar_path }} subtitle="Host" />
        <Card>
          <Stack gap={10}>
            <Row gap={8}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={{ flex: 1 }}>
                {m.city}
                {country ? `, ${country.flag_emoji} ${country.name}` : ''}
              </Text>
            </Row>
            {m.starts_at ? (
              <Row gap={8}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text>{formatDateTime(m.starts_at)}</Text>
              </Row>
            ) : null}
            <Row gap={8} align="flex-start">
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                {m.venue_hidden ? (
                  <Text color="textMuted">The host shares the venue with people who are going.</Text>
                ) : m.venue_name || m.venue_address ? (
                  <>
                    {m.venue_name ? <Text variant="bodyStrong">{m.venue_name}</Text> : null}
                    {m.venue_address ? <Text color="textMuted">{m.venue_address}</Text> : null}
                  </>
                ) : (
                  <Text color="textMuted">Venue to be agreed — chat with the host.</Text>
                )}
              </View>
            </Row>
            <Row gap={8}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text>
                {m.going_count} going{m.capacity ? ` of ${m.capacity}` : ''} · {m.interested_count} interested
              </Text>
            </Row>
          </Stack>
        </Card>
        {m.description ? <Text>{m.description}</Text> : null}

        {isHost ? (
          <Row gap={8} wrap>
            {open ? <Button title="Edit" icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/meetups/new', params: { edit: id } })} /> : null}
            {open ? (
              <Button
                title="Cancel meetup"
                variant="danger"
                loading={cancel.isPending}
                onPress={async () => {
                  if (await confirm('Cancel this meetup?', 'Everyone who responded will be notified.', 'Cancel meetup', true)) cancel.mutate();
                }}
              />
            ) : null}
          </Row>
        ) : open ? (
          <Row gap={8} wrap>
            <Button
              title={m.my_response === 'going' ? 'You’re going ✓' : 'I’m going'}
              variant={m.my_response === 'going' ? 'secondary' : 'primary'}
              loading={respond.isPending && respond.variables === 'going'}
              onPress={() => respond.mutate('going')}
              testID="meetup-going"
            />
            <Button
              title={m.my_response === 'interested' ? 'Interested ✓' : 'Interested'}
              variant="secondary"
              onPress={() => respond.mutate('interested')}
            />
            {m.my_response && m.my_response !== 'not_going' ? <Button title="Can’t make it" variant="ghost" onPress={() => leave.mutate()} /> : null}
          </Row>
        ) : null}

        <Banner icon="shield-checkmark-outline">
          Meet in public, tell someone where you’ll be, and leave whenever you want. Nobody is entitled to anything because you said yes to a meetup.
        </Banner>
        <Row gap={8} wrap>
          <Button title="Safety tips" variant="ghost" size="sm" onPress={() => router.push('/legal/safety')} />
          {!isHost ? (
            <Button
              title="Report"
              variant="ghost"
              size="sm"
              icon="flag-outline"
              onPress={() => router.push({ pathname: '/report', params: { type: 'meetup', id, userId: m.host_id, name: m.host_username } })}
            />
          ) : null}
        </Row>

        {going.length ? <SectionTitle title={`Going (${going.length})`} /> : null}
        {going.map((a) => (a.profile ? <PersonRow key={a.user_id} person={a.profile} /> : null))}
        {interested.length ? <SectionTitle title={`Interested (${interested.length})`} /> : null}
        {interested.map((a) => (a.profile ? <PersonRow key={a.user_id} person={a.profile} /> : null))}
      </Stack>
    </Screen>
  );
}
