import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { PersonRow } from '@/components/PersonRow';
import { TagPicker } from '@/components/TagPicker';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  OptionPicker,
  Row,
  Stack,
  Text,
  TextField,
} from '@/components/ui';
import { discoverPeople, getPrivacySettings, sendFriendRequest, setApproximateLocation, type DiscoverFilters } from '@/lib/api';
import { INTENTS, INTEREST_SUGGESTIONS, LANGUAGES } from '@/lib/constants';
import { notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useCountries } from '@/lib/hooks';
import type { DiscoverResult, SocialIntent } from '@/lib/types';
import { useTheme } from '@/theme';

const DISTANCES = [10, 25, 50, 100, 500];

export default function Discover() {
  const params = useLocalSearchParams<{ interest?: string }>();
  const { colors, spacing, radii, layout } = useTheme();
  const countries = useCountries();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>({ interests: params.interest ? [params.interest] : [] });

  // Tapping an interest on a profile opens Discover filtered by it.
  const [lastInterest, setLastInterest] = useState(params.interest);
  if (params.interest !== lastInterest) {
    setLastInterest(params.interest);
    if (params.interest) setFilters((f) => ({ ...f, interests: [params.interest!] }));
  }
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const effective = useMemo(() => ({ ...filters, query: debounced || null }), [filters, debounced]);
  const activeCount = [
    filters.country,
    filters.city,
    filters.interests?.length,
    filters.languages?.length,
    filters.minAge || filters.maxAge,
    filters.intent,
    filters.maxDistanceKm,
  ].filter(Boolean).length;

  const results = useInfiniteQuery({
    queryKey: ['discover', effective],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => discoverPeople(effective, pageParam),
    getNextPageParam: (last: DiscoverResult[], pages) => (last.length < 20 ? undefined : pages.length * 20),
  });
  const people = results.data?.pages.flat() ?? [];

  const header = (
    <Stack gap={12} style={{ marginBottom: 8 }}>
      <Row gap={8}>
        <Pressable
          onPress={() => router.push('/meetups')}
          accessibilityRole="button"
          style={{ flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.accentSoft, gap: 4 }}>
          <Ionicons name="cafe" size={22} color={colors.accent} />
          <Text variant="bodyStrong">Meetups & chill</Text>
          <Text variant="caption" color="textMuted">
            Coffee, football, exploring the city
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/dating')}
          accessibilityRole="button"
          style={{ flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.primarySoft, gap: 4 }}>
          <Ionicons name="heart" size={22} color={colors.danger} />
          <Text variant="bodyStrong">Dating</Text>
          <Text variant="caption" color="textMuted">
            Optional, private, opt-in
          </Text>
        </Pressable>
      </Row>
      <Row gap={8} align="flex-start">
        <View style={{ flex: 1 }}>
          <TextField placeholder="Search names, usernames or interests" value={query} onChangeText={setQuery} autoCapitalize="none" returnKeyType="search" testID="discover-search" />
        </View>
        <Button
          title={activeCount ? `Filters (${activeCount})` : 'Filters'}
          icon="options-outline"
          variant={showFilters ? 'primary' : 'secondary'}
          onPress={() => setShowFilters((s) => !s)}
          style={{ marginTop: 2 }}
        />
      </Row>
      {showFilters ? <FilterPanel filters={filters} onChange={setFilters} countryOptions={countries.options} /> : null}
      <Text variant="small" color="textMuted">
        {filters.country ? `People in ${countries.byCode.get(filters.country)?.name ?? filters.country}` : 'People across Africa'}
      </Text>
    </Stack>
  );

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Discover" />
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}
        renderItem={({ item }) => <DiscoverRow person={item} />}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        ListFooterComponent={results.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
        ListEmptyComponent={
          results.isLoading ? (
            <LoadingState />
          ) : results.isError ? (
            <ErrorState message={friendlyError(results.error)} onRetry={() => results.refetch()} />
          ) : (
            <EmptyState icon="search-outline" title="No one matches yet" message="Try fewer filters, or another country — Patapata is growing across the continent." />
          )
        }
      />
    </View>
  );
}

function DiscoverRow({ person }: { person: DiscoverResult }) {
  const queryClient = useQueryClient();
  const { byCode } = useCountries();
  const [state, setState] = useState(person.friendship);
  const add = useMutation({
    mutationFn: () => sendFriendRequest(person.id),
    onSuccess: (s) => {
      setState(s === 'accepted' ? 'friends' : 'request_sent');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (e) => notify('Could not send request', friendlyError(e)),
  });
  const country = person.country_code ? byCode.get(person.country_code) : undefined;
  const details = [
    person.age ? String(person.age) : null,
    person.city,
    country ? `${country.flag_emoji} ${country.name}` : null,
    person.distance_band,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ paddingVertical: 4 }}>
      <PersonRow
        person={person}
        subtitle={details || `@${person.username}`}
        right={
          state === 'none' ? (
            <Button title="Add" size="sm" icon="person-add-outline" loading={add.isPending} onPress={() => add.mutate()} />
          ) : (
            <Text variant="caption" color="textMuted">
              {state === 'friends' ? 'Friends' : state === 'request_sent' ? 'Requested' : 'Wants to connect'}
            </Text>
          )
        }
      />
      {person.interests.length ? (
        <Row wrap gap={6} style={{ marginLeft: 60 }}>
          {person.interests.slice(0, 4).map((i) => (
            <Chip key={i} label={i} />
          ))}
          {person.mutual_friends ? (
            <Text variant="caption" color="textMuted">
              {person.mutual_friends} mutual
            </Text>
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}

function FilterPanel({
  filters,
  onChange,
  countryOptions,
}: {
  filters: DiscoverFilters;
  onChange: (f: DiscoverFilters) => void;
  countryOptions: { value: string; label: string }[];
}) {
  const queryClient = useQueryClient();
  const privacy = useQuery({ queryKey: ['privacy'], queryFn: getPrivacySettings });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [minAge, setMinAge] = useState(filters.minAge ? String(filters.minAge) : '');
  const [maxAge, setMaxAge] = useState(filters.maxAge ? String(filters.maxAge) : '');
  const set = (patch: Partial<DiscoverFilters>) => onChange({ ...filters, ...patch });

  async function enableLocation() {
    setLocating(true);
    setLocError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Location permission was not granted.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      await setApproximateLocation(pos.coords.latitude, pos.coords.longitude);
      await queryClient.invalidateQueries({ queryKey: ['privacy'] });
    } catch (e) {
      setLocError(e instanceof Error && !('code' in e) ? e.message : friendlyError(e));
    } finally {
      setLocating(false);
    }
  }

  return (
    <Card>
      <Stack gap={14}>
        <OptionPicker label="Country" placeholder="Anywhere in Africa" options={countryOptions} value={filters.country ?? null} onChange={(c) => set({ country: c, city: null })} allowClear />
        <TextField label="City" placeholder="Any city" value={filters.city ?? ''} onChangeText={(c) => set({ city: c || null })} />
        <TagPicker label="Interests" value={filters.interests ?? []} onChange={(interests) => set({ interests })} suggestions={INTEREST_SUGGESTIONS.slice(0, 8)} max={10} />
        <OptionPicker label="Languages" placeholder="Any language" options={LANGUAGES} multiple values={filters.languages ?? []} onChangeMultiple={(languages) => set({ languages })} />
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Looking for
          </Text>
          <Row wrap gap={6}>
            {INTENTS.map((i) => (
              <Chip
                key={i.value}
                label={i.label}
                selected={filters.intent === i.value}
                onPress={() => set({ intent: filters.intent === i.value ? null : (i.value as SocialIntent) })}
              />
            ))}
          </Row>
        </View>
        <Row gap={8} align="flex-start">
          <View style={{ flex: 1 }}>
            <TextField
              label="Min age"
              keyboardType="number-pad"
              value={minAge}
              onChangeText={(t) => setMinAge(t.replace(/\D/g, '').slice(0, 2))}
              onEndEditing={() => set({ minAge: minAge ? Math.max(18, Number(minAge)) : null })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Max age"
              keyboardType="number-pad"
              value={maxAge}
              onChangeText={(t) => setMaxAge(t.replace(/\D/g, '').slice(0, 2))}
              onEndEditing={() => set({ maxAge: maxAge ? Number(maxAge) : null })}
            />
          </View>
        </Row>
        <Text variant="caption" color="textMuted">
          Age filters only include people who show their age.
        </Text>
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Distance (approximate)
          </Text>
          {privacy.data?.location_enabled ? (
            <Row wrap gap={6}>
              <Chip label="Any" selected={!filters.maxDistanceKm} onPress={() => set({ maxDistanceKm: null })} />
              {DISTANCES.map((d) => (
                <Chip key={d} label={`${d} km`} selected={filters.maxDistanceKm === d} onPress={() => set({ maxDistanceKm: d })} />
              ))}
            </Row>
          ) : (
            <>
              <Text variant="caption" color="textMuted">
                Optional. We store only a rough location (about 1 km) and show distance bands — never your exact position.
              </Text>
              <Button title="Use approximate location" icon="location-outline" variant="secondary" size="sm" loading={locating} onPress={enableLocation} />
            </>
          )}
          {locError ? <Banner tone="danger">{locError}</Banner> : null}
        </View>
        <Button title="Clear filters" variant="ghost" onPress={() => onChange({})} />
      </Stack>
    </Card>
  );
}
