import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack as RouterStack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Banner, Button, Card, Chip, EmptyState, ErrorState, IconButton, LoadingState, Row, Screen, Stack, Text } from '@/components/ui';
import { datingRespond, getDatingCandidates, getMyDatingPreferences } from '@/lib/api';
import { DATING_GOALS, languageLabel } from '@/lib/constants';
import { notify } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { useCountries } from '@/lib/hooks';
import { useTheme } from '@/theme';

export default function Dating() {
  const prefs = useQuery({ queryKey: ['dating-prefs'], queryFn: getMyDatingPreferences });
  if (prefs.isLoading) return <LoadingState />;
  if (prefs.isError) return <ErrorState message={friendlyError(prefs.error)} onRetry={() => prefs.refetch()} />;
  if (!prefs.data?.enabled) return <DatingIntro hasPrefs={Boolean(prefs.data)} />;
  return <Candidates paused={prefs.data.paused} />;
}

function DatingIntro({ hasPrefs }: { hasPrefs: boolean }) {
  const { colors } = useTheme();
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Text variant="title">Dating on Patapata</Text>
        <Text color="textMuted">
          Dating is optional and separate from your social profile. Nobody sees you in dating unless you turn it on, and your
          friends won’t see your dating activity unless you choose to show it.
        </Text>
        <Card>
          <Stack gap={12}>
            {[
              ['lock-closed-outline', 'Private likes', 'People only find out you liked them if they like you too.'],
              ['people-outline', 'Adults only', 'Dating is only available to members aged 18 and over.'],
              ['hand-left-outline', 'Consent comes first', 'A match means you both want to chat — nothing more. Anyone can unmatch, block or report at any time.'],
              ['cafe-outline', 'Meet safely', 'Meet in public, tell a friend, and arrange your own transport.'],
            ].map(([icon, title, body]) => (
              <Row key={title} gap={12} align="flex-start">
                <Ionicons name={icon as 'lock-closed-outline'} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{title}</Text>
                  <Text variant="small" color="textMuted">
                    {body}
                  </Text>
                </View>
              </Row>
            ))}
          </Stack>
        </Card>
        <Button title={hasPrefs ? 'Turn dating back on' : 'Set up dating'} size="lg" icon="heart" onPress={() => router.push('/dating/setup')} testID="dating-setup" />
        <Button title="Read safety tips" variant="ghost" onPress={() => router.push('/legal/safety')} />
      </Stack>
    </Screen>
  );
}

function Candidates({ paused }: { paused: boolean }) {
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const { byCode } = useCountries();
  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState<string | null>(null);
  const candidates = useQuery({ queryKey: ['dating-candidates'], queryFn: getDatingCandidates, enabled: !paused });

  const respond = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'like' | 'pass' }) => datingRespond(id, decision),
    onSuccess: (isMatch, { id }) => {
      if (isMatch) {
        setMatched(candidates.data?.find((c) => c.user_id === id)?.display_name ?? 'someone');
        queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
      }
      setIndex((i) => i + 1);
    },
    onError: (e) => notify('Something went wrong', friendlyError(e)),
  });

  const header = (
    <RouterStack.Screen
      options={{
        headerRight: () => (
          <Row gap={0}>
            <IconButton icon="heart-circle-outline" label="Matches" onPress={() => router.push('/dating/matches')} />
            <IconButton icon="options-outline" label="Dating settings" onPress={() => router.push('/dating/setup')} />
          </Row>
        ),
      }}
    />
  );

  if (paused) {
    return (
      <Screen edges={['left', 'right']}>
        {header}
        <EmptyState icon="pause-circle-outline" title="Dating is paused" message="You’re hidden from dating suggestions. Your matches and chats are still here." actionLabel="Dating settings" onAction={() => router.push('/dating/setup')} />
      </Screen>
    );
  }
  if (candidates.isLoading) return <LoadingState />;
  if (candidates.isError) return <ErrorState message={friendlyError(candidates.error)} onRetry={() => candidates.refetch()} />;

  const current = candidates.data?.[index];

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      {header}
      <Stack gap={16}>
        {matched ? (
          <Banner icon="heart">
            {`It’s a match with ${matched}! You can now message each other. Take your time and keep it respectful.`}
          </Banner>
        ) : null}
        {!current ? (
          <EmptyState
            icon="heart-outline"
            title="That’s everyone for now"
            message="Check back later, or widen your age range or countries in dating settings."
            actionLabel="Refresh"
            onAction={() => {
              setIndex(0);
              candidates.refetch();
            }}
          />
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: colors.primarySoft }}>
              <Avatar path={current.avatar_path} name={current.display_name} seed={current.user_id} size={140} />
            </View>
            <Stack gap={10} style={{ padding: 16 }}>
              <Text variant="title">
                {current.display_name}
                {current.age ? `, ${current.age}` : ''}
              </Text>
              <Text color="textMuted">
                {[current.city, byCode.get(current.country_code)?.name, current.distance_band].filter(Boolean).join(' · ')}
              </Text>
              {current.headline ? <Text variant="bodyStrong">“{current.headline}”</Text> : null}
              {current.about ? <Text>{current.about}</Text> : null}
              <Row wrap gap={6}>
                {current.goals.map((g) => (
                  <Chip key={g} label={DATING_GOALS.find((x) => x.value === g)?.label ?? g} />
                ))}
                {current.interests.slice(0, 6).map((i) => (
                  <Chip key={i} label={i} />
                ))}
              </Row>
              {current.languages.length ? (
                <Text variant="small" color="textMuted">
                  Speaks {current.languages.map(languageLabel).join(', ')}
                </Text>
              ) : null}
            </Stack>
            <Row gap={12} style={{ padding: 16, paddingTop: 0, justifyContent: 'center' }}>
              <Button
                title="Pass"
                icon="close"
                variant="secondary"
                size="lg"
                disabled={respond.isPending}
                onPress={() => respond.mutate({ id: current.user_id, decision: 'pass' })}
                style={{ flex: 1 }}
              />
              <Button
                title="Like"
                icon="heart"
                size="lg"
                loading={respond.isPending}
                onPress={() => respond.mutate({ id: current.user_id, decision: 'like' })}
                style={{ flex: 1 }}
                testID="dating-like"
              />
            </Row>
            <Button
              title="Report"
              variant="ghost"
              size="sm"
              icon="flag-outline"
              onPress={() => router.push({ pathname: '/report', params: { type: 'user', id: current.user_id, name: current.username } })}
              style={{ alignSelf: 'center', marginBottom: 12, borderRadius: radii.pill }}
            />
          </Card>
        )}
      </Stack>
    </Screen>
  );
}
