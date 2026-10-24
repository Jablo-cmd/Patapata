import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack as RouterStack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { MeetupCard } from '@/components/MeetupCard';
import { Banner, Button, Chip, EmptyState, ErrorState, LoadingState, OptionPicker, Row, Stack, TextField } from '@/components/ui';
import { getMyProfile, listMeetups } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { MEETUP_CATEGORIES } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import { useCountries } from '@/lib/hooks';
import type { Meetup, MeetupCategory } from '@/lib/types';
import { useTheme } from '@/theme';

export default function Meetups() {
  const me = useUserId();
  const { colors, spacing, layout } = useTheme();
  const countries = useCountries();
  const profile = useQuery({ queryKey: ['me'], queryFn: getMyProfile });
  const [country, setCountry] = useState<string | null | undefined>(undefined);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<MeetupCategory | null>(null);
  const [mine, setMine] = useState(false);
  const effectiveCountry = country === undefined ? profile.data?.country_code ?? null : country;

  const meetups = useInfiniteQuery({
    queryKey: ['meetups', effectiveCountry, city.trim(), category, mine],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listMeetups({ country: mine ? null : effectiveCountry, city: mine ? null : city.trim() || null, category, hostId: mine ? me : undefined, includePast: mine, offset: pageParam }),
    getNextPageParam: (last: Meetup[], pages) => (last.length < 20 ? undefined : pages.length * 20),
    enabled: country !== undefined || !profile.isLoading,
  });
  const items = meetups.data?.pages.flat() ?? [];

  return (
    <View style={{ flex: 1 }}>
      <RouterStack.Screen options={{ headerRight: () => <Button title="New" icon="add" size="sm" onPress={() => router.push('/meetups/new')} /> }} />
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MeetupCard meetup={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}
        onEndReached={() => meetups.hasNextPage && !meetups.isFetchingNextPage && meetups.fetchNextPage()}
        ListFooterComponent={meetups.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
        ListHeaderComponent={
          <Stack gap={12} style={{ marginBottom: spacing.md }}>
            <Banner icon="shield-checkmark-outline">
              Meet in public places, tell someone where you’re going, and arrange your own transport.
            </Banner>
            <Button title="Read safety tips" variant="ghost" size="sm" onPress={() => router.push('/legal/safety')} style={{ alignSelf: 'flex-start' }} />
            <Row gap={8} wrap>
              <Chip label="Near me" selected={!mine} onPress={() => setMine(false)} />
              <Chip label="Hosted by me" selected={mine} onPress={() => setMine(true)} />
            </Row>
            {!mine ? (
              <>
                <OptionPicker
                  label="Country"
                  placeholder="Anywhere in Africa"
                  options={countries.options}
                  value={effectiveCountry}
                  onChange={(c) => setCountry(c)}
                  allowClear
                />
                <TextField label="City" placeholder="Any city" value={city} onChangeText={setCity} />
              </>
            ) : null}
            <Row wrap gap={6}>
              {MEETUP_CATEGORIES.map((c) => (
                <Chip key={c.value} label={`${c.emoji} ${c.label}`} selected={category === c.value} onPress={() => setCategory(category === c.value ? null : c.value)} />
              ))}
            </Row>
          </Stack>
        }
        ListEmptyComponent={
          meetups.isLoading ? (
            <LoadingState />
          ) : meetups.isError ? (
            <ErrorState message={friendlyError(meetups.error)} onRetry={() => meetups.refetch()} />
          ) : (
            <EmptyState
              icon="cafe-outline"
              title="No invitations here yet"
              message="Start something! “Anyone up for coffee?” is all it takes."
              actionLabel="Create an invitation"
              onAction={() => router.push('/meetups/new')}
            />
          )
        }
      />
    </View>
  );
}
