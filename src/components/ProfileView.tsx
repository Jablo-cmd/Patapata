import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionMenu } from '@/components/ActionMenu';
import { FeedList } from '@/components/FeedList';
import { Avatar, Banner, Button, Chip, EmptyState, ErrorState, LoadingState, Row, Text } from '@/components/ui';
import {
  blockUser,
  cancelFriendRequest,
  getOrCreateConversation,
  getProfile,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/lib/api';
import { INTENTS, languageLabel } from '@/lib/constants';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { plural } from '@/lib/format';
import { useCountryLabel } from '@/lib/hooks';
import { publicImageUrl } from '@/lib/media';
import type { ProfileView as Profile } from '@/lib/types';
import { useTheme } from '@/theme';

export function ProfileScreen({ username, userId }: { username?: string; userId?: string }) {
  const profile = useQuery({
    queryKey: ['profile', username ?? userId],
    queryFn: () => getProfile({ username, userId }),
  });

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />;
  if (!profile.data) {
    return <EmptyState icon="person-outline" title="Profile unavailable" message="This member may have left Patapata, or isn’t available to you." />;
  }
  const p = profile.data;
  return (
    <FeedList
      scope="user"
      userId={p.id}
      header={<ProfileHeader profile={p} />}
      empty={<EmptyState icon="newspaper-outline" title="No posts to show" message={p.is_self ? 'Share your first post!' : 'Nothing shared with you yet.'} />}
    />
  );
}

function ProfileHeader({ profile: p }: { profile: Profile }) {
  const { colors, radii, spacing } = useTheme();
  const country = useCountryLabel(p.country_code);
  const cover = publicImageUrl(p.cover_path);
  const place = [p.city, p.region, country].filter(Boolean).join(', ');

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <View style={{ height: 120, backgroundColor: colors.primarySoft }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel="Cover photo" /> : null}
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md, marginTop: -48 }}>
        <View style={{ borderWidth: 4, borderColor: colors.surface, borderRadius: 52, alignSelf: 'flex-start' }}>
          <Avatar path={p.avatar_path} name={p.display_name} seed={p.id} size={88} />
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="title">{p.display_name}</Text>
          <Text color="textMuted">@{p.username}</Text>
        </View>
        {place || p.age ? (
          <Text variant="small" color="textMuted">
            {[p.age ? `${p.age}` : null, place].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {p.bio ? <Text>{p.bio}</Text> : null}
        {!p.details_visible ? <Banner>{p.display_name} shares their full profile with friends only.</Banner> : null}
        {p.intents.length ? (
          <Row wrap gap={6}>
            {p.intents.map((i) => (
              <Chip key={i} label={INTENTS.find((x) => x.value === i)?.label ?? i} />
            ))}
            {p.open_to_dating ? <Chip label="Open to dating" icon="heart" /> : null}
          </Row>
        ) : null}
        {p.interests.length ? (
          <View style={{ gap: 6 }}>
            <Text variant="caption" color="textMuted">
              INTERESTS
            </Text>
            <Row wrap gap={6}>
              {[...p.interests, ...p.hobbies].map((i) => (
                <Chip key={i} label={i} onPress={() => router.push({ pathname: '/discover', params: { interest: i } })} />
              ))}
            </Row>
          </View>
        ) : null}
        {p.languages.length ? (
          <Text variant="small" color="textMuted">
            Speaks {p.languages.map(languageLabel).join(', ')}
          </Text>
        ) : null}
        <Row gap={16}>
          {p.friends_count !== null ? (
            <Text
              variant="small"
              color="primary"
              style={{ fontWeight: '700' }}
              onPress={() => router.push(p.is_self ? '/friends' : `/friends/${p.id}`)}
              accessibilityRole="link">
              {plural(p.friends_count, 'friend')}
            </Text>
          ) : null}
          {!p.is_self && p.mutual_friends > 0 ? (
            <Text variant="small" color="textMuted">
              {plural(p.mutual_friends, 'mutual friend')}
            </Text>
          ) : null}
        </Row>
        {p.is_self ? <SelfActions /> : <OtherActions profile={p} />}
      </View>
    </View>
  );
}

function SelfActions() {
  return (
    <Row gap={8} wrap>
      <Button title="Edit profile" icon="create-outline" variant="secondary" size="sm" onPress={() => router.push('/settings/profile')} />
      <Button title="Settings" icon="settings-outline" variant="secondary" size="sm" onPress={() => router.push('/settings')} />
    </Row>
  );
}

function OtherActions({ profile: p }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
  };
  const onError = (e: unknown) => notify('Something went wrong', friendlyError(e));

  const add = useMutation({ mutationFn: () => sendFriendRequest(p.id), onSuccess: refresh, onError });
  const cancel = useMutation({ mutationFn: () => cancelFriendRequest(p.id), onSuccess: refresh, onError });
  const respond = useMutation({ mutationFn: (accept: boolean) => respondFriendRequest(p.id, accept), onSuccess: refresh, onError });
  const message = useMutation({
    mutationFn: () => getOrCreateConversation(p.id),
    onSuccess: (conversationId) => router.push(`/chat/${conversationId}`),
    onError,
  });

  const friendButton = (() => {
    switch (p.friendship) {
      case 'friends':
        return <Button title="Friends" icon="checkmark" variant="secondary" size="sm" onPress={() => setMenu(true)} />;
      case 'request_sent':
        return <Button title="Requested" icon="time-outline" variant="secondary" size="sm" loading={cancel.isPending} onPress={() => cancel.mutate()} accessibilityHint="Cancels your friend request" />;
      case 'request_received':
        return (
          <>
            <Button title="Accept" icon="person-add" size="sm" loading={respond.isPending} onPress={() => respond.mutate(true)} />
            <Button title="Decline" variant="secondary" size="sm" onPress={() => respond.mutate(false)} />
          </>
        );
      default:
        return p.can_send_friend_request ? (
          <Button title="Add friend" icon="person-add-outline" size="sm" loading={add.isPending} onPress={() => add.mutate()} testID="add-friend" />
        ) : null;
    }
  })();

  return (
    <>
      <Row gap={8} wrap>
        {friendButton}
        {p.can_message ? (
          <Button title="Message" icon="chatbubble-outline" variant="secondary" size="sm" loading={message.isPending} onPress={() => message.mutate()} testID="message-user" />
        ) : null}
        <Button title="More" icon="ellipsis-horizontal" variant="ghost" size="sm" onPress={() => setMenu(true)} />
      </Row>
      <ActionMenu
        visible={menu}
        onClose={() => setMenu(false)}
        title={`@${p.username}`}
        actions={[
          ...(p.friendship === 'friends'
            ? [
                {
                  label: 'Remove friend',
                  icon: 'person-remove-outline' as const,
                  onPress: async () => {
                    if (!(await confirm('Remove friend?', `You and ${p.display_name} will no longer be friends.`, 'Remove', true))) return;
                    removeFriend(p.id).then(refresh, onError);
                  },
                },
              ]
            : []),
          {
            label: 'Report profile',
            icon: 'flag-outline',
            onPress: () => router.push({ pathname: '/report', params: { type: 'user', id: p.id, name: p.username } }),
          },
          {
            label: 'Block',
            icon: 'ban-outline',
            destructive: true,
            onPress: async () => {
              if (!(await confirm(`Block @${p.username}?`, 'You won’t see each other’s profiles, posts or messages. They won’t be told.', 'Block', true))) return;
              try {
                await blockUser(p.id);
                queryClient.invalidateQueries();
                router.back();
              } catch (e) {
                onError(e);
              }
            },
          },
        ]}
      />
    </>
  );
}
