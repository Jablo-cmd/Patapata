import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack as RouterStack } from 'expo-router';
import type { ComponentProps } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Avatar, Button, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import type { NotificationRow } from '@/lib/types';
import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function describe(n: NotificationRow): { text: string; icon: IconName; go: () => void } {
  const who = n.actor?.display_name ?? 'Someone';
  const data = n.data as Record<string, string | number | boolean | null>;
  switch (n.type) {
    case 'friend_request':
      return { text: `${who} sent you a friend request`, icon: 'person-add', go: () => router.push('/friends') };
    case 'friend_accepted':
      return { text: `${who} accepted your friend request`, icon: 'people', go: () => n.actor && router.push(`/user/${n.actor.username}`) };
    case 'post_like':
      return { text: `${who} liked your post`, icon: 'heart', go: () => router.push(`/post/${n.post_id}`) };
    case 'post_comment':
      return { text: `${who} commented on your post`, icon: 'chatbubble', go: () => router.push(`/post/${n.post_id}`) };
    case 'comment_reply':
      return { text: `${who} replied to your comment`, icon: 'return-down-forward', go: () => router.push(`/post/${n.post_id}`) };
    case 'mention':
      return { text: `${who} mentioned you`, icon: 'at', go: () => router.push(`/post/${n.post_id}`) };
    case 'post_share':
      return { text: `${who} shared your post`, icon: 'repeat', go: () => router.push(`/post/${n.post_id}`) };
    case 'message': {
      const count = Number(data.count ?? 1);
      return { text: `${who} sent you ${count > 1 ? `${count} messages` : 'a message'}`, icon: 'chatbubbles', go: () => router.push(`/chat/${n.conversation_id}`) };
    }
    case 'meetup_response':
      return {
        text: `${who} is ${data.status === 'going' ? 'going to' : 'interested in'} your meetup`,
        icon: 'calendar',
        go: () => router.push(`/meetups/${n.meetup_id}`),
      };
    case 'meetup_update':
      return {
        text: data.change === 'cancelled' ? `A meetup you joined was cancelled` : `A meetup you joined changed its time or place`,
        icon: 'calendar-clear',
        go: () => router.push(`/meetups/${n.meetup_id}`),
      };
    case 'dating_match':
      return { text: `It’s a match! You and ${who} both want to chat`, icon: 'heart-circle', go: () => router.push('/dating/matches') };
    case 'security':
      return {
        text: data.event === 'password_changed' ? 'Your password was changed. If this wasn’t you, reset it now.' : 'Your email address was changed.',
        icon: 'shield-checkmark',
        go: () => router.push('/settings/account'),
      };
    case 'moderation':
      return {
        text:
          data.action === 'appeal_decided'
            ? `Your appeal was ${data.overturned ? 'accepted' : 'reviewed and the decision stands'}`
            : data.action === 'restore_content'
              ? 'Your content was restored'
              : data.action === 'warn'
                ? 'You received a warning from the moderators'
                : 'A moderator took action on your account or content',
        icon: 'shield',
        go: () => router.push('/settings/moderation'),
      };
    default:
      return { text: 'New activity', icon: 'notifications', go: () => undefined };
  }
}

export default function Notifications() {
  const { colors, spacing, layout } = useTheme();
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: ['notifications', 'list'], queryFn: listNotifications });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  return (
    <View style={{ flex: 1 }}>
      <RouterStack.Screen options={{ headerRight: () => <Button title="Mark all read" variant="ghost" size="sm" onPress={() => markAll.mutate()} /> }} />
      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          notifications.isLoading ? (
            <LoadingState />
          ) : notifications.isError ? (
            <ErrorState message={friendlyError(notifications.error)} onRetry={() => notifications.refetch()} />
          ) : (
            <EmptyState icon="notifications-outline" title="You’re all caught up" message="Friend requests, likes, comments and meetup news will appear here." />
          )
        }
        renderItem={({ item }) => {
          const d = describe(item);
          const unread = !item.read_at;
          return (
            <Pressable
              onPress={() => {
                if (unread) markNotificationRead(item.id).then(refresh).catch(() => undefined);
                d.go();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${unread ? 'Unread. ' : ''}${d.text}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: spacing.md,
                padding: spacing.lg,
                alignItems: 'center',
                backgroundColor: unread ? colors.primarySoft : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              })}>
              <View>
                {item.actor ? (
                  <Avatar path={item.actor.avatar_path} name={item.actor.display_name} seed={item.actor.id} size={44} />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={d.icon} size={22} color={colors.primary} />
                  </View>
                )}
                {item.actor ? (
                  <View style={{ position: 'absolute', right: -4, bottom: -4, backgroundColor: colors.surface, borderRadius: 12, padding: 3 }}>
                    <Ionicons name={d.icon} size={14} color={colors.primary} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant={unread ? 'bodyStrong' : 'body'}>{d.text}</Text>
                <Text variant="caption" color="textMuted">
                  {relativeTime(item.created_at)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
