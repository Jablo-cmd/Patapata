import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Banner, Button, Card, EmptyState, LoadingState, Row, Screen, Stack, Text, TextField } from '@/components/ui';
import { admin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

export default function AdminUsers() {
  const { account } = useAuth();
  const isAdmin = account?.staff_role === 'admin';
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const users = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => admin.searchUsers(q) });
  const act = useMutation({
    mutationFn: async ({ fn, success }: { fn: () => Promise<unknown>; success: string }) => {
      await fn();
      return success;
    },
    onSuccess: (success) => {
      setMessage({ tone: 'info', text: success });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => setMessage({ tone: 'danger', text: friendlyError(e) }),
  });
  const withReason = (fn: () => void) => {
    if (reason.trim().length < 3) {
      setMessage({ tone: 'danger', text: 'Enter a reason first (it is shown to the member and logged).' });
      return;
    }
    fn();
  };

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <Stack gap={12}>
        <TextField placeholder={isAdmin ? 'Username, name, email or ID' : 'Username, name or ID'} value={query} onChangeText={setQuery} autoCapitalize="none" />
        <TextField label="Reason for any action below" value={reason} onChangeText={setReason} />
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        {users.isLoading ? <LoadingState /> : null}
        {users.data && !users.data.length ? <EmptyState title="No members found" /> : null}
        {(users.data ?? []).map((u) => (
          <Card key={u.id}>
            <Stack gap={6}>
              <Text variant="bodyStrong">
                {u.display_name || '(not onboarded)'} {u.username ? `@${u.username}` : ''}
              </Text>
              <Text variant="small" color="textMuted">
                {u.status}
                {u.suspended_until ? ` until ${formatDateTime(u.suspended_until)}` : ''} · {u.country_code ?? '—'} · joined {formatDateTime(u.created_at)} · {u.reports_against} report(s)
                {u.staff_role ? ` · ${u.staff_role}` : ''}
              </Text>
              {u.email ? (
                <Text variant="caption" color="textMuted">
                  {u.email}
                </Text>
              ) : null}
              <Row wrap gap={6}>
                {u.status === 'active' ? (
                  <Button
                    title="Suspend 7 days"
                    size="sm"
                    variant="danger"
                    onPress={() =>
                      withReason(() =>
                        act.mutate({
                          fn: () => admin.setAccountStatus(u.id, 'suspended', reason.trim(), new Date(Date.now() + 7 * 86_400_000).toISOString()),
                          success: 'Suspended.',
                        }),
                      )
                    }
                  />
                ) : null}
                {u.status === 'suspended' || u.status === 'banned' ? (
                  <Button title="Reinstate" size="sm" variant="secondary" onPress={() => withReason(() => act.mutate({ fn: () => admin.setAccountStatus(u.id, 'active', reason.trim()), success: 'Reinstated.' }))} />
                ) : null}
                {isAdmin && u.status !== 'banned' && u.status !== 'pending' ? (
                  <Button
                    title="Ban"
                    size="sm"
                    variant="danger"
                    onPress={() =>
                      withReason(async () => {
                        if (await confirm('Ban member?', 'They can appeal.', 'Ban', true)) {
                          act.mutate({ fn: () => admin.setAccountStatus(u.id, 'banned', reason.trim()), success: 'Banned.' });
                        }
                      })
                    }
                  />
                ) : null}
                {isAdmin ? (
                  u.staff_role ? (
                    <Button title="Remove staff role" size="sm" variant="ghost" onPress={() => act.mutate({ fn: () => admin.setStaffRole(u.id, null), success: 'Role removed.' })} />
                  ) : (
                    <Button title="Make moderator" size="sm" variant="ghost" onPress={() => act.mutate({ fn: () => admin.setStaffRole(u.id, 'moderator'), success: 'Moderator role granted.' })} />
                  )
                ) : null}
              </Row>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
