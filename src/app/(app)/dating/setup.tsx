import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, Checkbox, Chip, LoadingState, OptionPicker, Row, Screen, Stack, Text, TextField, ToggleRow } from '@/components/ui';
import { getMyDatingPreferences, leaveDating, saveDatingPreferences, type DatingInput } from '@/lib/api';
import { DATING_GENDERS, DATING_GOALS } from '@/lib/constants';
import { confirm } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useCountries } from '@/lib/hooks';
import type { DatingGender, DatingGoal, DatingPreferences } from '@/lib/types';

export default function DatingSetup() {
  const prefs = useQuery({ queryKey: ['dating-prefs'], queryFn: getMyDatingPreferences });
  if (prefs.isLoading) return <LoadingState />;
  return <DatingForm existing={prefs.data ?? null} />;
}

function toInput(p: DatingPreferences | null): DatingInput {
  return {
    enabled: true,
    paused: p?.paused ?? false,
    gender: p?.gender ?? 'woman',
    interested_in: p?.interested_in ?? [],
    min_age: p?.min_age ?? 18,
    max_age: p?.max_age ?? 45,
    countries: p?.countries ?? [],
    max_distance_km: p?.max_distance_km ?? null,
    goals: p?.goals ?? ['not_sure'],
    headline: p?.headline ?? '',
    about: p?.about ?? '',
    show_on_profile: p?.show_on_profile ?? false,
  };
}

function DatingForm({ existing }: { existing: DatingPreferences | null }) {
  const queryClient = useQueryClient();
  const countries = useCountries();
  const [form, setForm] = useState<DatingInput>(() => toInput(existing));
  const [minAge, setMinAge] = useState(String(existing?.min_age ?? 18));
  const [maxAge, setMaxAge] = useState(String(existing?.max_age ?? 45));
  const [consent, setConsent] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dating-prefs'] });
    queryClient.invalidateQueries({ queryKey: ['dating-candidates'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const save = useMutation({
    mutationFn: (input: DatingInput) => saveDatingPreferences(input),
    onSuccess: () => {
      refresh();
      router.back();
    },
    onError: (e) => setError(friendlyError(e)),
  });
  const turnOff = useMutation({
    mutationFn: () => saveDatingPreferences({ ...form, enabled: false }),
    onSuccess: () => {
      refresh();
      router.back();
    },
    onError: (e) => setError(friendlyError(e)),
  });
  const erase = useMutation({
    mutationFn: leaveDating,
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
      router.back();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function submit() {
    const min = Number(minAge);
    const max = Number(maxAge);
    if (!form.interested_in.length) return setError('Choose who you’d like to meet.');
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 18 || max > 99 || min > max) return setError('Age range must be between 18 and 99.');
    if (!consent) return setError('Please confirm you understand how dating works on Patapata.');
    setError(null);
    save.mutate({ ...form, enabled: true, min_age: min, max_age: max, headline: form.headline.trim(), about: form.about.trim() });
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Card>
          <Stack gap={14}>
            <OptionPicker label="I am a" options={DATING_GENDERS} value={form.gender} onChange={(g) => g && setForm({ ...form, gender: g as DatingGender })} searchable={false} />
            <View style={{ gap: 6 }}>
              <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
                I’d like to meet
              </Text>
              <Row wrap gap={6}>
                {DATING_GENDERS.map((g) => (
                  <Chip key={g.value} label={g.label} selected={form.interested_in.includes(g.value)} onPress={() => setForm({ ...form, interested_in: toggleIn(form.interested_in, g.value) })} />
                ))}
              </Row>
            </View>
            <Row gap={8} align="flex-start">
              <View style={{ flex: 1 }}>
                <TextField label="Age from" keyboardType="number-pad" value={minAge} onChangeText={(t) => setMinAge(t.replace(/\D/g, '').slice(0, 2))} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="to" keyboardType="number-pad" value={maxAge} onChangeText={(t) => setMaxAge(t.replace(/\D/g, '').slice(0, 2))} />
              </View>
            </Row>
            <OptionPicker
              label="Countries"
              placeholder="Anywhere in Africa"
              options={countries.options}
              multiple
              values={form.countries}
              onChangeMultiple={(c) => setForm({ ...form, countries: c })}
            />
            <View style={{ gap: 6 }}>
              <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
                Looking for
              </Text>
              <Row wrap gap={6}>
                {DATING_GOALS.map((g) => (
                  <Chip key={g.value} label={g.label} selected={form.goals.includes(g.value)} onPress={() => setForm({ ...form, goals: toggleIn<DatingGoal>(form.goals, g.value) })} />
                ))}
              </Row>
            </View>
          </Stack>
        </Card>
        <Card>
          <Stack gap={14}>
            <TextField label="Headline (optional)" value={form.headline} onChangeText={(headline) => setForm({ ...form, headline })} maxLength={80} placeholder="Sunday markets and long walks" />
            <TextField label="About you for dating (optional)" value={form.about} onChangeText={(about) => setForm({ ...form, about })} multiline maxLength={500} maxLengthCounter />
            <ToggleRow title="Show “Open to dating” on my profile" subtitle="Off by default. Friends won’t see your dating activity." value={form.show_on_profile} onChange={(show_on_profile) => setForm({ ...form, show_on_profile })} />
            <ToggleRow title="Pause dating" subtitle="Hide from suggestions but keep your matches." value={form.paused} onChange={(paused) => setForm({ ...form, paused })} />
          </Stack>
        </Card>
        <Checkbox checked={consent} onChange={setConsent}>
          I understand that a like or match only means we’re both interested in talking, that I can unmatch, block or report at
          any time, and that I’ll follow the Community Guidelines.
        </Checkbox>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button title="Save and show me people" size="lg" onPress={submit} loading={save.isPending} fullWidth testID="dating-save" />
        {existing?.enabled ? <Button title="Turn off dating" variant="secondary" onPress={() => turnOff.mutate()} loading={turnOff.isPending} /> : null}
        {existing ? (
          <Button
            title="Leave dating and erase my dating data"
            variant="ghost"
            onPress={async () => {
              if (await confirm('Erase dating data?', 'This deletes your dating profile, likes and matches. Your social profile is not affected.', 'Erase', true)) {
                erase.mutate();
              }
            }}
          />
        ) : null}
      </Stack>
    </Screen>
  );
}
