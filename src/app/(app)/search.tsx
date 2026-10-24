import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { MeetupCard } from '@/components/MeetupCard';
import { PersonRow } from '@/components/PersonRow';
import { EmptyState, ErrorState, LoadingState, SegmentedControl, TextField } from '@/components/ui';
import { discoverPeople, listMeetups } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme';

type Tab = 'people' | 'posts' | 'meetups';

export default function Search() {
  const { spacing, layout } = useTheme();
  const [tab, setTab] = useState<Tab>('people');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
        <TextField placeholder="Search Patapata" value={query} onChangeText={setQuery} autoFocus autoCapitalize="none" returnKeyType="search" testID="search-input" />
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'people', label: 'People' },
            { value: 'posts', label: 'Posts' },
            { value: 'meetups', label: 'Meetups' },
          ]}
        />
      </View>
      {q.length < 2 ? (
        <EmptyState icon="search-outline" title="Search people, posts and meetups" message="Type at least 2 characters." />
      ) : tab === 'posts' ? (
        <FeedList scope="search" query={q} empty={<EmptyState title="No posts found" message="Only posts you’re allowed to see are searched." />} />
      ) : tab === 'people' ? (
        <PeopleResults q={q} />
      ) : (
        <MeetupResults q={q} />
      )}
    </View>
  );
}

function PeopleResults({ q }: { q: string }) {
  const { spacing, layout } = useTheme();
  const people = useQuery({ queryKey: ['search-people', q], queryFn: () => discoverPeople({ query: q }) });
  if (people.isLoading) return <LoadingState />;
  if (people.isError) return <ErrorState message={friendlyError(people.error)} onRetry={() => people.refetch()} />;
  if (!people.data?.length) return <EmptyState title="No people found" />;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
      {people.data.map((p) => (
        <PersonRow key={p.id} person={p} />
      ))}
    </ScrollView>
  );
}

function MeetupResults({ q }: { q: string }) {
  const { spacing, layout } = useTheme();
  const meetups = useQuery({ queryKey: ['search-meetups', q], queryFn: () => listMeetups({ query: q }) });
  if (meetups.isLoading) return <LoadingState />;
  if (meetups.isError) return <ErrorState message={friendlyError(meetups.error)} onRetry={() => meetups.refetch()} />;
  if (!meetups.data?.length) return <EmptyState title="No meetups found" />;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
      {meetups.data.map((m) => (
        <MeetupCard key={m.id} meetup={m} />
      ))}
    </ScrollView>
  );
}
