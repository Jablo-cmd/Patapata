import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Banner, Button, Screen, Stack, Text, TextField } from '@/components/ui';
import { blockUser, createReport } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import type { ReportReason, ReportTarget } from '@/lib/types';
import { useTheme } from '@/theme';

const TARGET_LABEL: Record<ReportTarget, string> = {
  user: 'this member',
  post: 'this post',
  comment: 'this comment',
  message: 'this message',
  meetup: 'this meetup',
};

export default function Report() {
  const params = useLocalSearchParams<{ type: ReportTarget; id: string; userId?: string; name?: string }>();
  const { colors, radii } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const blockTarget = params.type === 'user' ? params.id : params.userId;

  async function submit() {
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createReport(params.type, params.id, reason, details.trim());
      setDone(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack gap={16}>
          <Text variant="title">Thanks for telling us</Text>
          <Text color="textMuted">
            A moderator will review your report. Reports are confidential — the person is not told who reported them. We
            prioritise threats and child-safety reports.
          </Text>
          {blockTarget && !blocked ? (
            <Button
              title={`Block ${params.name ? '@' + params.name : 'this member'} too`}
              variant="secondary"
              icon="ban-outline"
              onPress={async () => {
                try {
                  await blockUser(blockTarget);
                  setBlocked(true);
                } catch (e) {
                  setError(friendlyError(e));
                }
              }}
            />
          ) : null}
          {blocked ? <Banner>Blocked. You won’t see each other on Patapata.</Banner> : null}
          <Button title="Done" onPress={() => router.back()} />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Text variant="title">Report {TARGET_LABEL[params.type] ?? 'content'}</Text>
        <Banner tone="warning">If someone is in immediate danger, contact local emergency services first.</Banner>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {REPORT_REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => setReason(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={{
                  padding: 12,
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                }}>
                <Text variant="bodyStrong">{r.label}</Text>
                <Text variant="small" color="textMuted">
                  {r.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextField label="Anything else we should know? (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} maxLengthCounter />
        <Button title="Send report" size="lg" onPress={submit} loading={busy} fullWidth testID="report-submit" />
      </Stack>
    </Screen>
  );
}
