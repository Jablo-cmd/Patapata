import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Avatar, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { listConversations } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { useTheme } from '@/theme';

export default function Messages() {
  const { colors, spacing, layout } = useTheme();
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: listConversations });

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Messages" />
      <FlatList
        data={conversations.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          conversations.isLoading ? (
            <LoadingState />
          ) : conversations.isError ? (
            <ErrorState message={friendlyError(conversations.error)} onRetry={() => conversations.refetch()} />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              message="Message a friend or a match from their profile. Messages are private between you and them."
              actionLabel="See friends"
              onAction={() => router.push('/friends')}
            />
          )
        }
      />
    </View>
  );
}

function ConversationRow({ conversation: c }: { conversation: Conversation }) {
  const me = useUserId();
  const { colors, spacing } = useTheme();
  const unread = c.unread_count > 0;
  const preview = c.last_message_body ?? (c.last_message_has_attachment ? '📷 Photo' : 'Message deleted');
  const name = c.other_display_name ?? 'Patapata member';
  return (
    <Pressable
      onPress={() => router.push(`/chat/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${name}${unread ? `, ${c.unread_count} unread` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.75 : 1,
      })}>
      <Avatar path={c.other_avatar_path} name={name} seed={c.other_user_id ?? c.id} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color={unread ? 'primary' : 'textMuted'}>
            {relativeTime(c.last_message_at)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="small" color={unread ? 'text' : 'textMuted'} style={{ flex: 1, fontWeight: unread ? '700' : '400' }} numberOfLines={1}>
            {c.last_message_sender_id === me ? 'You: ' : ''}
            {preview}
          </Text>
          {unread ? (
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
              <Text variant="caption" style={{ color: '#0B1F3A', fontWeight: '800' }}>
                {c.unread_count > 98 ? '99+' : c.unread_count}
              </Text>
            </View>
          ) : !c.can_reply ? (
            <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} accessibilityLabel="Read only" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
