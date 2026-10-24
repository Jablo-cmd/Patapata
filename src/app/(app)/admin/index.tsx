import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Banner, Card, Divider, ErrorState, ListRow, LoadingState, Row, Screen, SectionTitle, Stack, Text } from '@/components/ui';
import { admin } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatCount } from '@/lib/format';
import { useTheme } from '@/theme';

function Stat({ label, value, tone }: { label: string; value: unknown; tone?: 'danger' | 'accent' }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 140,
        padding: 14,
        borderRadius: radii.md,
        backgroundColor: tone === 'danger' ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 2,
      }}>
      <Text variant="title" color={tone === 'danger' && Number(value) > 0 ? 'danger' : 'text'}>
        {typeof value === 'number' ? formatCount(value) : String(value ?? '–')}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

export default function AdminHome() {
  const metrics = useQuery({ queryKey: ['admin', 'metrics'], queryFn: admin.metrics, refetchInterval: 60_000 });
  if (metrics.isLoading) return <LoadingState />;
  if (metrics.isError || !metrics.data) return <ErrorState message={friendlyError(metrics.error)} onRetry={() => metrics.refetch()} />;
  const m = metrics.data as Record<string, number | string | Record<string, number>>;
  const byCountry = (m.members_by_country ?? {}) as Record<string, number>;
  const dbMb = Math.round(Number(m.database_size_bytes ?? 0) / 1024 / 1024);

  return (
    <Screen edges={['left', 'right', 'bottom']} refreshing={metrics.isRefetching} onRefresh={() => void metrics.refetch()}>
      <Stack gap={16}>
        {Number(m.reports_urgent_open) > 0 ? (
          <Banner tone="danger">
            {`${m.reports_urgent_open} urgent report(s) open — threats, child safety, self-harm or underage. Review these first and follow the escalation procedure in docs/SAFETY.md.`}
          </Banner>
        ) : null}
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="flag-outline" title="Report queue" subtitle={`${m.reports_open} open`} onPress={() => router.push('/admin/reports')} />
          <Divider />
          <ListRow icon="hand-left-outline" title="Appeals" subtitle={`${m.appeals_open} awaiting review`} onPress={() => router.push('/admin/appeals')} />
          <Divider />
          <ListRow icon="people-outline" title="Members" subtitle="Search, suspend, reinstate, roles" onPress={() => router.push('/admin/users')} />
        </Card>
        <SectionTitle title="Safety" />
        <Row wrap gap={8}>
          <Stat label="Open reports" value={m.reports_open} tone="danger" />
          <Stat label="Urgent open" value={m.reports_urgent_open} tone="danger" />
          <Stat label="Open appeals" value={m.appeals_open} />
          <Stat label="Suspended" value={m.members_suspended} />
          <Stat label="Banned" value={m.members_banned} />
          <Stat label="Heavy rate-limit hits (1h)" value={m.rate_limit_hits_1h} />
        </Row>
        <SectionTitle title="Community" />
        <Row wrap gap={8}>
          <Stat label="Active members" value={m.members_total} />
          <Stat label="Active last 7 days" value={m.active_7d} />
          <Stat label="Sign-ups last 7 days" value={m.signups_7d} />
          <Stat label="Awaiting onboarding" value={m.members_pending_onboarding} />
          <Stat label="Posts (24h)" value={m.posts_24h} />
          <Stat label="Comments (24h)" value={m.comments_24h} />
          <Stat label="Messages (24h)" value={m.messages_24h} />
          <Stat label="Upcoming meetups" value={m.meetups_upcoming} />
          <Stat label="Dating enabled" value={m.dating_enabled} />
        </Row>
        <SectionTitle title="Operations" />
        <Row wrap gap={8}>
          <Stat label="Database size (MB)" value={dbMb} />
          <Stat label="Files awaiting cleanup" value={m.storage_cleanup_pending} />
          <Stat label="Accounts due for purge" value={m.accounts_due_for_purge} />
        </Row>
        <Text variant="caption" color="textMuted">
          Free-tier database limit is 500 MB. See docs/COSTS.md for what happens when limits are reached.
        </Text>
        {Object.keys(byCountry).length ? (
          <>
            <SectionTitle title="Members by country" />
            <Card>
              {Object.entries(byCountry).map(([code, n]) => (
                <Row key={code} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text>{code}</Text>
                  <Text variant="bodyStrong">{n}</Text>
                </Row>
              ))}
            </Card>
          </>
        ) : null}
      </Stack>
    </Screen>
  );
}
