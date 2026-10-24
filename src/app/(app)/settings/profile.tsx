import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LocationFields } from '@/components/LocationFields';
import { TagPicker } from '@/components/TagPicker';
import { Avatar, Banner, Button, Card, Chip, ErrorState, LoadingState, OptionPicker, Row, Screen, SectionTitle, Stack, Text, TextField } from '@/components/ui';
import { changeUsername, getMyProfile, updateMyProfile, usernameAvailable } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { INTENTS, INTEREST_SUGGESTIONS, LANGUAGES } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import { pickImages, publicImageUrl, uploadImage } from '@/lib/media';
import type { ProfileView, SocialIntent } from '@/lib/types';
import { normalizeUsername, validateUsername } from '@/lib/validation';
import { useTheme } from '@/theme';

export default function EditProfile() {
  const profile = useQuery({ queryKey: ['me'], queryFn: getMyProfile });
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) return <ErrorState message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile: p }: { profile: ProfileView }) {
  const me = useUserId();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(p.display_name);
  const [username, setUsername] = useState(p.username);
  const [bio, setBio] = useState(p.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(p.avatar_path);
  const [cover, setCover] = useState<string | null>(p.cover_path);
  const [location, setLocation] = useState<{ country: string | null; region: string; city: string }>({
    country: p.country_code,
    region: p.region ?? '',
    city: p.city ?? '',
  });
  const [languages, setLanguages] = useState<string[]>(p.languages);
  const [interests, setInterests] = useState<string[]>(p.interests);
  const [hobbies, setHobbies] = useState<string[]>(p.hobbies);
  const [intents, setIntents] = useState<SocialIntent[]>(p.intents);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(kind: 'avatar' | 'cover') {
    setError(null);
    try {
      const [image] = await pickImages();
      if (!image) return;
      setUploading(kind);
      const uploaded = await uploadImage('avatars', me, image, kind === 'avatar' ? 'avatar' : 'cover');
      if (kind === 'avatar') setAvatar(uploaded.path);
      else setCover(uploaded.path);
    } catch (e) {
      setError((e as Error).message === 'photo_permission_denied' ? 'Allow photo access in your settings.' : friendlyError(e));
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setError(null);
    if (!displayName.trim()) return setError('Enter your name.');
    if (!location.country) return setError('Choose your country.');
    const newUsername = normalizeUsername(username);
    const usernameError = validateUsername(newUsername);
    if (usernameError) return setError(usernameError);
    setBusy(true);
    try {
      if (newUsername !== p.username) {
        if (!(await usernameAvailable(newUsername))) throw new Error('username_unavailable');
        await changeUsername(newUsername);
      }
      await updateMyProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_path: avatar,
        cover_path: cover,
        country_code: location.country,
        region: location.region || null,
        city: location.city.trim() || null,
        languages,
        interests,
        hobbies,
        intents,
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const coverUrl = publicImageUrl(cover);

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Pressable onPress={() => pick('cover')} accessibilityRole="button" accessibilityLabel="Change cover photo">
          <View style={{ height: 120, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            {coverUrl ? <Image source={{ uri: coverUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <Text variant="small" style={{ fontWeight: '700' }} color="onPrimarySoft">
              {uploading === 'cover' ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add a cover photo'}
            </Text>
          </View>
        </Pressable>
        <Row gap={16}>
          <Avatar path={avatar} name={displayName} seed={me} size={80} />
          <Stack gap={6}>
            <Button title={uploading === 'avatar' ? 'Uploading…' : 'Change photo'} variant="secondary" size="sm" onPress={() => pick('avatar')} disabled={Boolean(uploading)} />
            {avatar ? <Button title="Remove photo" variant="ghost" size="sm" onPress={() => setAvatar(null)} /> : null}
          </Stack>
        </Row>
        <Text variant="caption" color="textMuted">
          Your profile photo, name, username and country are visible to all members. Don’t use photos that show your home or ID.
        </Text>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Card>
          <Stack gap={14}>
            <TextField label="Name" value={displayName} onChangeText={setDisplayName} maxLength={50} />
            <TextField label="Username" value={username} onChangeText={(t) => setUsername(normalizeUsername(t))} autoCapitalize="none" maxLength={30} hint="You can change this up to 3 times a day." />
            <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={500} maxLengthCounter placeholder="A little about you" />
          </Stack>
        </Card>
        <Card>
          <Stack gap={14}>
            <SectionTitle title="Location" />
            <LocationFields country={location.country} region={location.region} city={location.city} onChange={setLocation} />
          </Stack>
        </Card>
        <Card>
          <Stack gap={14}>
            <OptionPicker label="Languages" options={LANGUAGES} multiple values={languages} onChangeMultiple={setLanguages} />
            <TagPicker label="Interests" value={interests} onChange={setInterests} suggestions={INTEREST_SUGGESTIONS.slice(0, 12)} />
            <TagPicker label="Hobbies" value={hobbies} onChange={setHobbies} />
            <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
              Here for
            </Text>
            <Row wrap gap={6}>
              {INTENTS.map((i) => (
                <Chip key={i.value} label={i.label} selected={intents.includes(i.value)} onPress={() => setIntents((cur) => (cur.includes(i.value) ? cur.filter((x) => x !== i.value) : [...cur, i.value]))} />
              ))}
            </Row>
          </Stack>
        </Card>
        <Button title="Save profile" size="lg" onPress={save} loading={busy} disabled={Boolean(uploading)} fullWidth />
      </Stack>
    </Screen>
  );
}
