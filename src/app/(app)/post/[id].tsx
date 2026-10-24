import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/ActionMenu';
import { PostCard, RichText } from '@/components/PostCard';
import { Avatar, EmptyState, ErrorState, IconButton, LoadingState, Text, TextField } from '@/components/ui';
import { addComment, deleteComment, getPost, listComments } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import type { CommentRow } from '@/lib/types';
import { useTheme } from '@/theme';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, spacing, layout } = useTheme();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [menuFor, setMenuFor] = useState<CommentRow | null>(null);

  const post = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id) });
  const comments = useQuery({ queryKey: ['comments', id], queryFn: () => listComments(id), enabled: Boolean(post.data) });

  // Top-level comments followed by their replies.
  const threaded = useMemo(() => {
    const all = comments.data ?? [];
    const top = all.filter((c) => !c.parent_id);
    return top.flatMap((c) => [c, ...all.filter((r) => r.parent_id === c.id)]);
  }, [comments.data]);

  const send = useMutation({
    mutationFn: () => addComment(id, draft.trim(), replyTo?.parent_id ?? replyTo?.id ?? null),
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
    onError: (e) => notify('Could not comment', friendlyError(e)),
  });

  if (post.isLoading) return <LoadingState />;
  if (post.isError) return <ErrorState message={friendlyError(post.error)} onRetry={() => post.refetch()} />;
  if (!post.data) {
    return <EmptyState icon="eye-off-outline" title="Post unavailable" message="It may have been deleted, or you may not have permission to see it." />;
  }

  const isPostOwner = post.data.author_id === me;
  const canDelete = (c: CommentRow) => c.author_id === me || isPostOwner;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={threaded}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <PostCard post={post.data} detail />
            <Text variant="heading" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              Comments
            </Text>
          </View>
        }
        ListEmptyComponent={
          comments.isLoading ? <LoadingState /> : <Text color="textMuted" style={{ padding: spacing.lg }}>No comments yet. Start the conversation.</Text>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, paddingLeft: item.parent_id ? spacing.lg + 40 : spacing.lg }}>
            <Pressable onPress={() => item.author && router.push(`/user/${item.author.username}`)}>
              <Avatar path={item.author?.avatar_path} name={item.author?.display_name} seed={item.author_id} size={item.parent_id ? 28 : 36} />
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text variant="small" style={{ fontWeight: '700' }}>
                  {item.author?.display_name ?? 'Patapata member'}
                </Text>
                {item.status === 'removed' ? (
                  <Text variant="small" color="textMuted" style={{ fontStyle: 'italic' }}>
                    Removed by moderators
                  </Text>
                ) : (
                  <RichText text={item.body} />
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 16, paddingLeft: 6 }}>
                <Text variant="caption" color="textMuted">
                  {relativeTime(item.created_at)}
                  {item.edited_at ? ' · edited' : ''}
                </Text>
                <Pressable onPress={() => setReplyTo(item)} accessibilityRole="button" hitSlop={8}>
                  <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                    Reply
                  </Text>
                </Pressable>
                <Pressable onPress={() => setMenuFor(item)} accessibilityRole="button" accessibilityLabel="Comment options" hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: insets.bottom, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        {replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 4 }}>
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              Replying to {replyTo.author?.display_name ?? 'comment'}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" hitSlop={8}>
              <Text variant="caption" color="primary">
                Cancel
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Write a comment…" value={draft} onChangeText={setDraft} maxLength={2000} multiline style={{ maxHeight: 120 }} testID="comment-input" />
          </View>
          <IconButton
            icon="send"
            label="Send comment"
            color={draft.trim() ? colors.primary : colors.textMuted}
            onPress={() => draft.trim() && !send.isPending && send.mutate()}
            testID="comment-send"
          />
        </View>
      </View>

      <ActionMenu
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        actions={[
          ...(menuFor && canDelete(menuFor)
            ? [
                {
                  label: 'Delete comment',
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: async () => {
                    const target = menuFor;
                    if (!(await confirm('Delete comment?', 'This cannot be undone.', 'Delete', true))) return;
                    try {
                      await deleteComment(target.id);
                      queryClient.invalidateQueries({ queryKey: ['comments', id] });
                    } catch (e) {
                      notify('Could not delete', friendlyError(e));
                    }
                  },
                },
              ]
            : []),
          ...(menuFor && menuFor.author_id !== me
            ? [
                {
                  label: 'Report comment',
                  icon: 'flag-outline' as const,
                  onPress: () => router.push({ pathname: '/report', params: { type: 'comment', id: menuFor.id } }),
                },
              ]
            : []),
        ]}
      />
    </KeyboardAvoidingView>
  );
}
