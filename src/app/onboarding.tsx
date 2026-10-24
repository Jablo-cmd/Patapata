import { Link } from 'expo-router';
import { useEffect, useState } from 'react';

import { BirthDateField, type BirthDateParts } from '@/components/BirthDateField';
import { LocationFields } from '@/components/LocationFields';
import { TagPicker } from '@/components/TagPicker';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  OptionPicker,
  Row,
  Screen,
  SectionTitle,
  Stack,
  Text,
  TextField,
} from '@/components/ui';
import { completeOnboarding, usernameAvailable } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { INTENTS, INTEREST_SUGGESTIONS, LANGUAGES } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import type { SocialIntent } from '@/lib/types';
import { normalizeUsername, parseBirthDate, validateUsername } from '@/lib/validation';

export default function Onboarding() {
  const { refreshAccount, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [checked, setChecked] = useState<{ username: string; available: boolean } | null>(null);
  const [birth, setBirth] = useState<BirthDateParts>({ day: '', month: '', year: '' });
  const [location, setLocation] = useState<{ country: string | null; region: string; city: string }>({
    country: null,
    region: '',
    city: '',
  });
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [interests, setInterests] = useState<string[]>([]);
  const [intents, setIntents] = useState<SocialIntent[]>(['friendship']);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced username availability check; the status itself is derived.
  const candidate = normalizeUsername(username);
  const candidateValid = !validateUsername(candidate);
  useEffect(() => {
    if (!candidateValid) return;
    const t = setTimeout(() => {
      usernameAvailable(candidate)
        .then((available) => setChecked({ username: candidate, available }))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [candidate, candidateValid]);
  const usernameState: 'idle' | 'checking' | 'available' | 'taken' = !candidateValid
    ? 'idle'
    : checked?.username !== candidate
      ? 'checking'
      : checked.available
        ? 'available'
        : 'taken';

  async function submit() {
    const birthResult = parseBirthDate(birth.day, birth.month, birth.year);
    const next: Record<string, string | null> = {
      displayName: displayName.trim() ? null : 'Enter the name people will see.',
      username: validateUsername(username) ?? (usernameState === 'taken' ? 'That username is taken.' : null),
      birth: birthResult.ok ? null : birthResult.error,
      country: location.country ? null : 'Choose your country.',
      agree: agree ? null : 'Please accept to continue.',
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean) || !birthResult.ok) {
      setFormError('Please check the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding({
        username: normalizeUsername(username),
        displayName: displayName.trim(),
        birthDate: birthResult.isoDate,
        countryCode: location.country!,
        region: location.region || null,
        city: location.city.trim() || null,
        languages,
        interests,
        intents,
        acceptTerms: agree,
        termsVersion: config.termsVersion,
      });
      // Either "ok" or "age_ineligible": the account state decides where to go next.
      await refreshAccount();
    } catch (e) {
      setFormError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const usernameHint =
    usernameState === 'checking'
      ? 'Checking…'
      : usernameState === 'available'
        ? '✓ Available'
        : 'Letters, numbers and underscores. People can find you by this.';

  return (
    <Screen keyboard>
      <Stack gap={20}>
        <Stack gap={6}>
          <Text variant="title" accessibilityRole="header">
            Set up your profile
          </Text>
          <Text color="textMuted">This takes about a minute. You can change most of it later.</Text>
        </Stack>

        <Card>
          <Stack gap={16}>
            <SectionTitle title="About you" />
            <TextField
              label="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
              autoComplete="name"
              error={errors.displayName}
              testID="onboarding-name"
            />
            <TextField
              label="Username"
              value={username}
              onChangeText={(t) => setUsername(normalizeUsername(t))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              hint={usernameHint}
              error={errors.username ?? (usernameState === 'taken' ? 'That username is taken.' : null)}
              testID="onboarding-username"
            />
            <BirthDateField value={birth} onChange={setBirth} error={errors.birth} />
          </Stack>
        </Card>

        <Card>
          <Stack gap={16}>
            <SectionTitle title="Where you are" />
            <Text variant="small" color="textMuted">
              You can connect with people anywhere in Africa — this just helps people near you find you.
            </Text>
            <LocationFields
              country={location.country}
              region={location.region}
              city={location.city}
              onChange={setLocation}
              countryError={errors.country}
            />
          </Stack>
        </Card>

        <Card>
          <Stack gap={16}>
            <SectionTitle title="What you’re into" />
            <OptionPicker
              label="Languages you speak"
              options={LANGUAGES}
              multiple
              values={languages}
              onChangeMultiple={setLanguages}
            />
            <TagPicker label="Interests" value={interests} onChange={setInterests} suggestions={INTEREST_SUGGESTIONS.slice(0, 14)} />
            <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
              What are you here for?
            </Text>
            <Row wrap gap={8}>
              {INTENTS.map((i) => (
                <Chip
                  key={i.value}
                  label={i.label}
                  selected={intents.includes(i.value)}
                  onPress={() =>
                    setIntents((cur) => (cur.includes(i.value) ? cur.filter((x) => x !== i.value) : [...cur, i.value]))
                  }
                />
              ))}
            </Row>
            <Text variant="caption" color="textMuted">
              Dating is a separate, optional mode you can turn on later. It is never shown on your profile unless you choose.
            </Text>
          </Stack>
        </Card>

        <Checkbox checked={agree} onChange={setAgree} testID="onboarding-agree">
          <Text>
            I confirm I am 18 or older and agree to the{' '}
            <Link href="/legal/guidelines">
              <Text color="primary">Community Guidelines</Text>
            </Link>
            ,{' '}
            <Link href="/legal/terms">
              <Text color="primary">Terms</Text>
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy">
              <Text color="primary">Privacy Policy</Text>
            </Link>
            .
          </Text>
        </Checkbox>
        {errors.agree ? (
          <Text variant="small" color="danger">
            {errors.agree}
          </Text>
        ) : null}
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
        <Button title="Join Patapata" size="lg" fullWidth onPress={submit} loading={busy} testID="onboarding-submit" />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </Stack>
    </Screen>
  );
}
