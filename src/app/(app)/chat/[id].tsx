import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, Stack as RouterStack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { MessageImage } from '@/components/PostImages';
import { Avatar, Banner, IconButton, LoadingState, Text, TextField } from '@/components/ui';
import {
  blockUser,
  deleteMessage,
  getConversationMembers,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { pickImages, uploadImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import type { MessageRow } from '@/lib/types';
import { useTheme } from '@/theme';

type Pages = InfiniteData<MessageRow[], string | null>;

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, spacing, layout, radii } = useTheme();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<MessageRow | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const key = useMemo(() => ['messages', id], [id]);

  const members = useQuery({ queryKey: ['conversation-members', id], queryFn: () => getConversationMembers(id) });
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: listConversations });
  const other = members.data?.find((m) => m.user_id !== me);
  const canReply = conversations.data?.find((c) => c.id === id)?.can_reply ?? true;

  const messages = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listMessages(id, pageParam ?? undefined),
    getNextPageParam: (last: MessageRow[]) => (last.length < 40 ? undefined : last[last.length - 1].created_at),
  });
  const rows = messages.data?.pages.flat() ?? [];

  // Mark as read on open and whenever new messages arrive.
  const newest = rows[0]?.id;
  useEffect(() => {
    if (!newest) return;
    markConversationRead(id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => undefined);
  }, [id, newest, queryClient]);

  // Realtime: new and deleted messages appear without polling. RLS ensures
  // only conversation members receive these events.
  useEffect(() => {
    const upsert = (row: MessageRow) =>
      queryClient.setQueryData<Pages>(key, (data) => {
        if (!data) return data;
        const exists = data.pages.some((p) => p.some((m) => m.id === row.id));
        if (exists) {
          return { ...data, pages: data.pages.map((p) => p.map((m) => (m.id === row.id ? row : m))) };
        }
        const [first = [], ...rest] = data.pages;
        return { ...data, pages: [[row, ...first.filter((m) => !(m.pending && m.sender_id === row.sender_id && m.body === row.body))], ...rest] };
      });
    const channel = supabase
      .channel(`chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) =>
        upsert(payload.new as MessageRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) =>
        upsert(payload.new as MessageRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, key, queryClient]);

  const addPending = (row: MessageRow) =>
    queryClient.setQueryData<Pages>(key, (data) =>
      data ? { ...data, pages: [[row, ...(data.pages[0] ?? [])], ...data.pages.slice(1)] } : data,
    );

  async function send(attachmentPath?: string) {
    const body = attachmentPath ? '' : draft.trim();
    if (!body && !attachmentPath) return;
    const requestId = uuid();
    if (!attachmentPath) {
      setDraft('');
      addPending({ id: requestId, conversation_id: id, sender_id: me, body, attachment_path: null, deleted_at: null, created_at: new Date().toISOString(), pending: true });
    }
    try {
      await sendMessage({ conversationId: id, body, attachmentPath, clientRequestId: requestId });
    } catch (e) {
      notify('Message not sent', friendlyError(e));
      if (!attachmentPath) setDraft(body);
    } finally {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }

  async function sendPhoto() {
    try {
      const [image] = await pickImages({ multiple: false });
      if (!image) return;
      setSending(true);
      const uploaded = await uploadImage('message-media', `${id}/${me}`, image, 'message');
      await send(uploaded.path);
    } catch (e) {
      notify('Photo not sent', (e as Error).message === 'photo_permission_denied' ? 'Allow photo access in your settings.' : friendlyError(e));
    } finally {
      setSending(false);
    }
  }

  const name = other?.profile?.display_name ?? 'Conversation';
  const headerActions: MenuAction[] = other?.profile
    ? [
        { label: 'View profile', icon: 'person-outline', onPress: () => router.push(`/user/${other.profile!.username}`) },
        {
          label: 'Report',
          icon: 'flag-outline',
          onPress: () => router.push({ pathname: '/report', params: { type: 'user', id: other.user_id, name: other.profile!.username } }),
        },
        {
          label: 'Block',
          icon: 'ban-outline',
          destructive: true,
          onPress: async () => {
            if (!(await confirm(`Block ${name}?`, 'They won’t be able to message you, and you won’t see each other on Patapata.', 'Block', true))) return;
            try {
              await blockUser(other.user_id);
              queryClient.invalidateQueries();
              router.back();
            } catch (e) {
              notify('Could not block', friendlyError(e));
            }
          },
        },
      ]
    : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <RouterStack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={() => other?.profile && router.push(`/user/${other.profile.username}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              accessibilityRole="link">
              <Avatar path={other?.profile?.avatar_path} name={name} seed={other?.user_id} size={32} />
              <Text variant="heading" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ),
          headerRight: () => <IconButton icon="ellipsis-vertical" label="Conversation options" onPress={() => setHeaderMenu(true)} />,
        }}
      />
      {messages.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: 6, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}
          onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            messages.isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} />
            ) : !messages.hasNextPage ? (
              <Banner icon="shield-checkmark-outline">
                Messages are private to this conversation. Never send money or ID documents to someone you haven’t met, and meet in public places.
              </Banner>
            ) : undefined
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <Pressable
                onLongPress={() => !item.deleted_at && !item.pending && setMenuFor(item)}
                accessibilityHint="Long press for options"
                style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <View
                  style={{
                    backgroundColor: mine ? colors.primary : colors.surface,
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.border,
                    borderRadius: radii.lg,
                    borderBottomRightRadius: mine ? 4 : radii.lg,
                    borderBottomLeftRadius: mine ? radii.lg : 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: item.pending ? 0.6 : 1,
                    gap: 6,
                  }}>
                  {item.deleted_at ? (
                    <Text variant="small" style={{ fontStyle: 'italic', color: mine ? colors.onPrimary : colors.textMuted }}>
                      Message deleted
                    </Text>
                  ) : (
                    <>
                      {item.attachment_path ? <MessageImage path={item.attachment_path} /> : null}
                      {item.body ? <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{item.body}</Text> : null}
                    </>
                  )}
                </View>
                <Text variant="caption" color="textMuted" align={mine ? 'right' : 'left'} style={{ marginTop: 2 }}>
                  {item.pending ? 'Sending…' : new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: insets.bottom, paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
        {canReply ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
            {sending ? <ActivityIndicator color={colors.primary} style={{ width: 44 }} /> : <IconButton icon="image-outline" label="Send a photo" onPress={sendPhoto} />}
            <View style={{ flex: 1 }}>
              <TextField placeholder="Message" value={draft} onChangeText={setDraft} multiline maxLength={4000} style={{ maxHeight: 120 }} testID="chat-input" />
            </View>
            <IconButton icon="send" label="Send message" color={draft.trim() ? colors.primary : colors.textMuted} onPress={() => send()} testID="chat-send" />
          </View>
        ) : (
          <Text variant="small" color="textMuted" align="center" style={{ padding: spacing.md }}>
            You can’t reply in this conversation.
          </Text>
        )}
      </View>

      <ActionMenu visible={headerMenu} onClose={() => setHeaderMenu(false)} actions={headerActions} />
      <ActionMenu
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor?.sender_id === me
            ? [
                {
                  label: 'Delete for everyone',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: async () => {
                    const target = menuFor;
                    if (!(await confirm('Delete message?', 'It will be removed for everyone in this conversation.', 'Delete', true))) return;
                    deleteMessage(target.id)
                      .then(() => queryClient.invalidateQueries({ queryKey: key }))
                      .catch((e) => notify('Could not delete', friendlyError(e)));
                  },
                },
              ]
            : [
                {
                  label: 'Report message',
                  icon: 'flag-outline',
                  onPress: () =>
                    router.push({
                      pathname: '/report',
                      params: { type: 'message', id: menuFor!.id, userId: menuFor!.sender_id, name: other?.profile?.username },
                    }),
                },
              ]
        }
      />
    </KeyboardAvoidingView>
  );
}

