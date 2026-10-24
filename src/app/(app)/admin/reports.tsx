import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, Row, Screen, SegmentedControl, Stack, Text } from '@/components/ui';
import { admin } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import { useTheme } from '@/theme';

type Filter = 'queue' | 'actioned' | 'dismissed';

export default function ReportQueue() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('queue');
  const reports = useQuery({
    queryKey: ['admin', 'reports', filter],
    queryFn: () => admin.listReports(filter === 'queue' ? undefined : filter),
    refetchInterval: 60_000,
  });

  return (
    <Screen edges={['left', 'right', 'bottom']} refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()}>
      <Stack gap={12}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'queue', label: 'Open' },
            { value: 'actioned', label: 'Actioned' },
            { value: 'dismissed', label: 'Dismissed' },
          ]}
        />
        {reports.isLoading ? <LoadingState /> : null}
        {reports.isError ? <ErrorState message={friendlyError(reports.error)} onRetry={() => reports.refetch()} /> : null}
        {reports.data && !reports.data.length ? <EmptyState icon="checkmark-done-outline" title="Queue is clear" /> : null}
        {(reports.data ?? []).map((r) => (
          <Card key={r.id} onPress={() => router.push(`/admin/report/${r.id}`)}>
            <Stack gap={6}>
              <Row gap={8}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: r.priority === 'urgent' ? colors.danger : r.priority === 'high' ? colors.accent : colors.surfaceAlt,
                  }}>
                  <Text variant="caption" style={{ color: r.priority === 'normal' ? colors.text : '#FFFFFF', fontWeight: '800' }}>
                    {r.priority.toUpperCase()}
                  </Text>
                </View>
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {r.target_type.toUpperCase()} · {r.status.replace('_', ' ')} · {relativeTime(r.created_at)}
                </Text>
              </Row>
              <Text variant="bodyStrong">{REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</Text>
              <Text variant="small" color="textMuted">
                Against @{r.target_username ?? 'deleted'} ({r.reports_against_target} report{r.reports_against_target === 1 ? '' : 's'} total) · by @
                {r.reporter_username ?? 'deleted'}
              </Text>
              {r.details ? (
                <Text variant="small" numberOfLines={2}>
                  “{r.details}”
                </Text>
              ) : null}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
