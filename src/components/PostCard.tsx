import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionMenu, type MenuAction } from '@/components/ActionMenu';
import { PostImages } from '@/components/PostImages';
import { Avatar, Text } from '@/components/ui';
import { blockUser, deletePost, setLike } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { formatCount, relativeTime } from '@/lib/format';
import type { FeedPost } from '@/lib/types';
import { useTheme } from '@/theme';

const AUDIENCE_ICON = { public: 'earth', friends: 'people', only_me: 'lock-closed' } as const;
const AUDIENCE_LABEL = { public: 'Everyone', friends: 'Friends', only_me: 'Only me' } as const;

/** Renders text with @mentions highlighted and tappable. */
export function RichText({ text, numberOfLines }: { text: string; numberOfLines?: number }) {
  const parts = text.split(/(@[A-Za-z0-9_]{3,30})/g);
  return (
    <Text numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} color="primary" variant="bodyStrong" onPress={() => router.push(`/user/${part.slice(1).toLowerCase()}`)}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export const PostCard = memo(function PostCard({ post, detail = false }: { post: FeedPost; detail?: boolean }) {
  const { colors, spacing, radii } = useTheme();
  const me = useUserId();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.like_count);
  const [menu, setMenu] = useState(false);
  const mine = post.author_id === me;

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await setLike(post.id, next);
    } catch (e) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      notify('Could not update like', friendlyError(e));
    }
  }

  const refreshFeeds = () => queryClient.invalidateQueries({ queryKey: ['feed'] });

  const actions: MenuAction[] = mine
    ? [
        { label: 'Edit post', icon: 'create-outline', onPress: () => router.push({ pathname: '/compose', params: { edit: post.id } }) },
        {
          label: 'Delete post',
          icon: 'trash-outline',
          destructive: true,
          onPress: async () => {
            if (!(await confirm('Delete post?', 'This cannot be undone.', 'Delete', true))) return;
            try {
              await deletePost(post.id);
              refreshFeeds();
              if (detail) router.back();
            } catch (e) {
              notify('Could not delete', friendlyError(e));
            }
          },
        },
      ]
    : [
        {
          label: 'Report post',
          icon: 'flag-outline',
          onPress: () => router.push({ pathname: '/report', params: { type: 'post', id: post.id } }),
        },
        {
          label: `Block @${post.author_username}`,
          icon: 'ban-outline',
          destructive: true,
          onPress: async () => {
            if (!(await confirm(`Block @${post.author_username}?`, 'You won’t see each other’s posts, profiles or messages. They won’t be told.', 'Block', true)))
              return;
            try {
              await blockUser(post.author_id);
              refreshFeeds();
            } catch (e) {
              notify('Could not block', friendlyError(e));
            }
          },
        },
      ];

  const open = () => !detail && router.push(`/post/${post.id}`);
  const shareable = post.audience === 'public' && post.status === 'active';

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: detail ? 0 : radii.lg,
        borderWidth: detail ? 0 : 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable onPress={() => router.push(`/user/${post.author_username}`)} accessibilityRole="link" accessibilityLabel={`${post.author_display_name}'s profile`}>
          <Avatar path={post.author_avatar_path} name={post.author_display_name} seed={post.author_id} size={42} />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/user/${post.author_username}`)}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {post.author_display_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text variant="small" color="textMuted">
              @{post.author_username} · {relativeTime(post.created_at)}
              {post.edited_at ? ' · edited' : ''} ·
            </Text>
            <Ionicons name={AUDIENCE_ICON[post.audience]} size={12} color={colors.textMuted} accessibilityLabel={`Visible to: ${AUDIENCE_LABEL[post.audience]}`} />
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Post options" style={{ padding: 6 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {post.status === 'removed' ? (
        <Text variant="small" color="danger">
          This post was removed for breaking the Community Guidelines and is only visible to you.
        </Text>
      ) : null}

      <Pressable onPress={open} disabled={detail} accessibilityRole={detail ? undefined : 'button'} accessibilityHint="Opens the post" style={{ gap: spacing.md }}>
        {post.body ? <RichText text={post.body} numberOfLines={detail ? undefined : 12} /> : null}
        <PostImages media={post.media} />
      </Pressable>

      {post.shared_post_id ? (
        post.shared_post ? (
          <Pressable
            onPress={() => router.push(`/post/${post.shared_post!.id}`)}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar path={post.shared_post.author_avatar_path} name={post.shared_post.author_display_name} seed={post.shared_post.author_id} size={24} />
              <Text variant="small" style={{ fontWeight: '700' }}>
                {post.shared_post.author_display_name}
              </Text>
              <Text variant="small" color="textMuted">
                · {relativeTime(post.shared_post.created_at)}
              </Text>
            </View>
            {post.shared_post.body ? <RichText text={post.shared_post.body} numberOfLines={6} /> : null}
            <PostImages media={post.shared_post.media} />
          </Pressable>
        ) : (
          <Text variant="small" color="textMuted" style={{ fontStyle: 'italic' }}>
            The original post is no longer available.
          </Text>
        )
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingTop: 2 }}>
        <Pressable
          onPress={toggleLike}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? `Unlike. ${likes} likes` : `Like. ${likes} likes`}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.danger : colors.textMuted} />
          <Text variant="small" color="textMuted">
            {formatCount(likes)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/post/${post.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Comments. ${post.comment_count}`}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text variant="small" color="textMuted">
            {formatCount(post.comment_count)}
          </Text>
        </Pressable>
        {shareable ? (
          <Pressable
            onPress={() => router.push({ pathname: '/compose', params: { share: post.shared_post && !post.body && !post.media.length ? post.shared_post.id : post.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Share. ${post.share_count} shares`}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
            <Ionicons name="repeat" size={22} color={colors.textMuted} />
            <Text variant="small" color="textMuted">
              {formatCount(post.share_count)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ActionMenu visible={menu} onClose={() => setMenu(false)} actions={actions} />
    </View>
  );
});
