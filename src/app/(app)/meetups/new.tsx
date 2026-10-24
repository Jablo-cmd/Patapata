import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack as RouterStack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LocationFields } from '@/components/LocationFields';
import { Banner, Button, Chip, LoadingState, Row, Screen, SegmentedControl, Stack, Text, TextField } from '@/components/ui';
import { createMeetup, getMeetup, getMyProfile, updateMeetup, type MeetupInput } from '@/lib/api';
import { MEETUP_CATEGORIES } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import type { Meetup, MeetupCategory } from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Parses DD/MM/YYYY + HH:MM in the device's local time zone. */
function parseLocal(date: string, time: string): Date | null {
  const d = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const t = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) return null;
  const value = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  if (value.getDate() !== Number(d[1]) || value.getMonth() !== Number(d[2]) - 1 || Number(t[1]) > 23) return null;
  return value;
}

function toFields(iso: string | null) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export default function NewMeetup() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const me = useQuery({ queryKey: ['me'], queryFn: getMyProfile });
  const existing = useQuery({ queryKey: ['meetup', edit], queryFn: () => getMeetup(edit!), enabled: Boolean(edit) });
  if (me.isLoading || (edit && existing.isLoading)) return <LoadingState />;
  return <MeetupForm editId={edit} existing={existing.data ?? null} defaultCountry={me.data?.country_code ?? null} defaultCity={me.data?.city ?? ''} />;
}

function MeetupForm({
  editId: edit,
  existing: m,
  defaultCountry,
  defaultCity,
}: {
  editId?: string;
  existing: Meetup | null;
  defaultCountry: string | null;
  defaultCity: string;
}) {
  const queryClient = useQueryClient();
  const start = toFields(m?.starts_at ?? null);
  const [kind, setKind] = useState<'chill' | 'event'>(m?.kind ?? 'chill');
  const [title, setTitle] = useState(m?.title ?? '');
  const [description, setDescription] = useState(m?.description ?? '');
  const [category, setCategory] = useState<MeetupCategory>(m?.category ?? 'coffee');
  const [location, setLocation] = useState<{ country: string | null; region: string; city: string }>({
    country: m?.country_code ?? defaultCountry,
    region: '',
    city: m?.city ?? defaultCity,
  });
  const [venueName, setVenueName] = useState(m?.venue_name ?? '');
  const [venueAddress, setVenueAddress] = useState(m?.venue_address ?? '');
  const [venueVisibility, setVenueVisibility] = useState<'everyone' | 'attendees'>(m?.venue_visibility ?? 'attendees');
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [capacity, setCapacity] = useState(m?.capacity ? String(m.capacity) : '');
  const [audience, setAudience] = useState<'public' | 'friends'>(m?.audience ?? 'public');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (title.trim().length < 3) return setError('Give your invitation a title.');
    if (!location.country || !location.city.trim()) return setError('Choose a country and city.');
    let startsAt: string | null = null;
    if (kind === 'event' || date || time) {
      const parsed = parseLocal(date.trim(), time.trim());
      if (!parsed) return setError('Enter the date as DD/MM/YYYY and the time as HH:MM.');
      if (parsed.getTime() < Date.now()) return setError('Choose a time in the future.');
      startsAt = parsed.toISOString();
    }
    const cap = capacity ? Number(capacity) : null;
    if (cap !== null && (!Number.isInteger(cap) || cap < 2 || cap > 500)) return setError('Capacity must be between 2 and 500.');

    const input: MeetupInput = {
      kind,
      title: title.trim(),
      description: description.trim(),
      category,
      country_code: location.country,
      city: location.city.trim(),
      venue_name: venueName.trim() || null,
      venue_address: venueAddress.trim() || null,
      venue_visibility: venueVisibility,
      starts_at: startsAt,
      ends_at: null,
      capacity: cap,
      audience,
    };
    setBusy(true);
    try {
      if (edit) {
        const { country_code: _ignored, ...update } = input;
        await updateMeetup(edit, update);
        queryClient.invalidateQueries({ queryKey: ['meetup', edit] });
        queryClient.invalidateQueries({ queryKey: ['meetups'] });
        router.back();
      } else {
        const id = await createMeetup(input);
        queryClient.invalidateQueries({ queryKey: ['meetups'] });
        router.replace(`/meetups/${id}`);
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <RouterStack.Screen options={{ title: edit ? 'Edit invitation' : 'New invitation' }} />
      <Stack gap={16}>
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'chill', label: 'Chill invite' },
            { value: 'event', label: 'Scheduled meetup' },
          ]}
        />
        <Text variant="small" color="textMuted">
          {kind === 'chill'
            ? 'A quick, open invitation — “Anyone up for coffee in Accra?”. Time and place are optional.'
            : 'A meetup with a date and time — “Watch the football this Saturday”.'}
        </Text>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Anyone interested in coffee?" testID="meetup-title" />
        <TextField label="Details (optional)" value={description} onChangeText={setDescription} multiline maxLength={2000} maxLengthCounter />
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Category
          </Text>
          <Row wrap gap={6}>
            {MEETUP_CATEGORIES.map((c) => (
              <Chip key={c.value} label={`${c.emoji} ${c.label}`} selected={category === c.value} onPress={() => setCategory(c.value)} />
            ))}
          </Row>
        </View>
        {edit ? (
          <TextField label="City" value={location.city} onChangeText={(city) => setLocation((l) => ({ ...l, city }))} maxLength={80} />
        ) : (
          <LocationFields country={location.country} region={location.region} city={location.city} onChange={setLocation} cityRequired />
        )}
        <Row gap={8} align="flex-start">
          <View style={{ flex: 1.4 }}>
            <TextField label={kind === 'event' ? 'Date' : 'Date (optional)'} placeholder="DD/MM/YYYY" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Time" placeholder="HH:MM" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </Row>
        <Banner tone="warning">Choose a public place such as a café, park or venue. Never use a home address.</Banner>
        <TextField label="Venue (optional)" placeholder="e.g. Neighbourhood café" value={venueName} onChangeText={setVenueName} maxLength={120} />
        <TextField label="Venue address (optional)" value={venueAddress} onChangeText={setVenueAddress} maxLength={200} />
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Who sees the venue?
          </Text>
          <Row gap={6}>
            <Chip label="Only people going" selected={venueVisibility === 'attendees'} onPress={() => setVenueVisibility('attendees')} />
            <Chip label="Everyone who can see it" selected={venueVisibility === 'everyone'} onPress={() => setVenueVisibility('everyone')} />
          </Row>
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Who can see this invitation?
          </Text>
          <Row gap={6}>
            <Chip label="Everyone" icon="earth" selected={audience === 'public'} onPress={() => setAudience('public')} />
            <Chip label="Friends" icon="people" selected={audience === 'friends'} onPress={() => setAudience('friends')} />
          </Row>
        </View>
        <TextField label="Maximum people (optional)" keyboardType="number-pad" value={capacity} onChangeText={(t) => setCapacity(t.replace(/\D/g, '').slice(0, 3))} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button title={edit ? 'Save changes' : 'Publish invitation'} size="lg" onPress={submit} loading={busy} fullWidth testID="meetup-submit" />
      </Stack>
    </Screen>
  );
}
