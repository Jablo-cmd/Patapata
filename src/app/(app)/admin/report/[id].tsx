import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MessageImage } from '@/components/PostImages';
import { Banner, Button, Card, Chip, ErrorState, LoadingState, Row, Screen, SectionTitle, Stack, Text, TextField } from '@/components/ui';
import { admin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS } from '@/lib/constants';
import { confirm } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { ReportTarget } from '@/lib/types';

const SUSPENSIONS = [1, 3, 7, 30];

export default function ReviewReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'report', id], queryFn: () => admin.getReport(id) });

  const done = (text: string) => {
    setResult({ tone: 'info', text });
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };
  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError: (e) => setResult({ tone: 'danger', text: friendlyError(e) }),
  });

  if (detail.isLoading) return <LoadingState />;
  if (detail.isError || !detail.data) return <ErrorState message={friendlyError(detail.error)} onRetry={() => detail.refetch()} />;

  const d = detail.data;
  const report = d.report;
  const target = d.target_user;
  const content = d.current_content;
  const evidence = report.evidence ?? {};
  const contentType = report.target_type as ReportTarget;
  const contentId: string | undefined = report.post_id && contentType === 'post' ? report.post_id : report.comment_id ?? report.meetup_id ?? undefined;
  const reason = note.trim();
  const needReason = () => {
    if (reason.length < 3) {
      setResult({ tone: 'danger', text: 'Write the reason the member will see (at least 3 characters).' });
      return false;
    }
    return true;
  };

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}
        <Card>
          <Stack gap={6}>
            <Text variant="caption" color={report.priority === 'urgent' ? 'danger' : 'textMuted'}>
              {String(report.priority).toUpperCase()} · {String(report.status).toUpperCase()} · {formatDateTime(report.created_at)}
            </Text>
            <Text variant="heading">{REPORT_REASONS.find((r) => r.value === report.reason)?.label ?? report.reason}</Text>
            {report.details ? <Text>“{report.details}”</Text> : null}
            <Text variant="small" color="textMuted">
              Reported by @{d.reporter?.username ?? 'deleted account'}
            </Text>
          </Stack>
        </Card>
        {report.priority === 'urgent' ? (
          <Banner tone="danger">
            Urgent: if there is a credible threat to life or a child-safety concern, follow the escalation steps in docs/SAFETY.md (preserve evidence, restrict the account, and contact the appropriate authority where required).
          </Banner>
        ) : null}

        <SectionTitle title="Reported content (snapshot at time of report)" />
        <Card>
          <Stack gap={8}>
            {evidence.body ? <Text>{evidence.body}</Text> : null}
            {evidence.title ? <Text variant="bodyStrong">{evidence.title}</Text> : null}
            {evidence.description ? <Text>{evidence.description}</Text> : null}
            {evidence.bio ? <Text>Bio: {evidence.bio}</Text> : null}
            {evidence.attachment_path ? <MessageImage path={evidence.attachment_path} /> : null}
            {report.target_type === 'message' ? (
              <Text variant="caption" color="textMuted">
                Moderators see only this reported message, not the rest of the conversation.
              </Text>
            ) : null}
            {content ? (
              <Text variant="caption" color="textMuted">
                Current status: {content.status}
              </Text>
            ) : null}
          </Stack>
        </Card>

        {target ? (
          <>
            <SectionTitle title="Member" />
            <Card>
              <Stack gap={4}>
                <Text variant="bodyStrong">
                  {target.display_name} (@{target.username})
                </Text>
                <Text variant="small" color="textMuted">
                  Status: {target.status}
                  {target.suspended_until ? ` until ${formatDateTime(target.suspended_until)}` : ''} · joined {formatDateTime(target.created_at)}
                </Text>
                <Text variant="small" color="textMuted">
                  {d.related_reports.length} other report(s) · {d.previous_actions.length} previous action(s)
                </Text>
                {d.previous_actions.slice(0, 5).map((a: { id: string; action: string; reason: string; created_at: string }) => (
                  <Text key={a.id} variant="caption" color="textMuted">
                    • {a.action} — {a.reason} ({formatDateTime(a.created_at)})
                  </Text>
                ))}
              </Stack>
            </Card>
          </>
        ) : null}

        <SectionTitle title="Decision" />
        <TextField label="Reason (shown to the member and kept in the audit log)" value={note} onChangeText={setNote} multiline maxLength={1000} />
        <Row wrap gap={8}>
          <Button
            title="Mark in review"
            variant="secondary"
            size="sm"
            onPress={() => action.mutate(() => admin.updateReport(id, 'in_review').then(() => done('Marked in review.')))}
          />
          <Button
            title="Dismiss — no violation"
            variant="secondary"
            size="sm"
            onPress={() => action.mutate(() => admin.updateReport(id, 'dismissed', reason || 'No violation found').then(() => done('Report dismissed.')))}
          />
        </Row>
        {contentId && content ? (
          <Row wrap gap={8}>
            {content.status === 'removed' ? (
              <Button
                title="Restore content"
                size="sm"
                variant="secondary"
                onPress={() => needReason() && action.mutate(() => admin.moderateContent(contentType, contentId, false, reason, id).then(() => done('Content restored.')))}
              />
            ) : (
              <Button
                title="Remove content"
                size="sm"
                variant="danger"
                onPress={() => needReason() && action.mutate(() => admin.moderateContent(contentType, contentId, true, reason, id).then(() => done('Content removed and member notified.')))}
              />
            )}
          </Row>
        ) : null}
        {target ? (
          <Stack gap={8}>
            <Row wrap gap={8}>
              <Button
                title="Warn member"
                size="sm"
                variant="secondary"
                onPress={() => needReason() && action.mutate(() => admin.warnUser(target.id, reason, id).then(() => done('Warning sent.')))}
              />
            </Row>
            <Row wrap gap={6}>
              <Text variant="small" color="textMuted">
                Suspend for:
              </Text>
              {SUSPENSIONS.map((n) => (
                <Chip key={n} label={`${n} day${n === 1 ? '' : 's'}`} selected={days === n} onPress={() => setDays(n)} />
              ))}
            </Row>
            <Row wrap gap={8}>
              <Button
                title={`Suspend ${days} day${days === 1 ? '' : 's'}`}
                size="sm"
                variant="danger"
                onPress={() =>
                  needReason() &&
                  action.mutate(() =>
                    admin
                      .setAccountStatus(target.id, 'suspended', reason, new Date(Date.now() + days * 86_400_000).toISOString(), id)
                      .then(() => done('Member suspended and notified.')),
                  )
                }
              />
              {account?.staff_role === 'admin' ? (
                <Button
                  title="Ban permanently"
                  size="sm"
                  variant="danger"
                  onPress={async () => {
                    if (!needReason()) return;
                    if (!(await confirm('Ban this member?', 'They will lose access to Patapata. They can appeal.', 'Ban', true))) return;
                    action.mutate(() => admin.setAccountStatus(target.id, 'banned', reason, undefined, id).then(() => done('Member banned.')));
                  }}
                />
              ) : null}
              {target.status !== 'active' ? (
                <Button
                  title="Reinstate"
                  size="sm"
                  variant="secondary"
                  onPress={() => needReason() && action.mutate(() => admin.setAccountStatus(target.id, 'active', reason).then(() => done('Member reinstated.')))}
                />
              ) : null}
            </Row>
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}
