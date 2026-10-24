import { useInfiniteQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { ErrorState, LoadingState } from '@/components/ui';
import { getFeed, type FeedCursor, type FeedScope } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import type { FeedPost } from '@/lib/types';
import { useTheme } from '@/theme';

const PAGE = 15;

/** Keyset-paginated feed: loads 15 posts at a time, never the whole table. */
export function FeedList({
  scope,
  userId,
  country,
  query,
  header,
  empty,
}: {
  scope: FeedScope;
  userId?: string;
  country?: string | null;
  query?: string;
  header?: ReactElement | null;
  empty: ReactElement;
}) {
  const { colors, spacing, layout } = useTheme();
  const feed = useInfiniteQuery({
    queryKey: ['feed', scope, userId ?? null, country ?? null, query ?? null],
    initialPageParam: null as FeedCursor,
    queryFn: ({ pageParam }) => getFeed(scope, { userId, country: country ?? undefined, query, cursor: pageParam, limit: PAGE }),
    getNextPageParam: (last: FeedPost[]) =>
      last.length < PAGE ? undefined : { before: last[last.length - 1].created_at, beforeId: last[last.length - 1].id },
    enabled: scope !== 'search' || Boolean(query && query.trim().length > 1),
  });

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xxxl,
        width: '100%',
        maxWidth: layout.maxContentWidth,
        alignSelf: 'center',
      }}
      ListHeaderComponent={header ? <View style={{ marginBottom: spacing.md }}>{header}</View> : undefined}
      ListEmptyComponent={
        feed.isLoading ? (
          <LoadingState />
        ) : feed.isError ? (
          <ErrorState message={friendlyError(feed.error)} onRetry={() => feed.refetch()} />
        ) : (
          empty
        )
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : undefined}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />
      }
      initialNumToRender={6}
      windowSize={7}
      removeClippedSubviews
    />
  );
}
