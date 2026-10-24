import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { listConversations, listCountries, listRegions, unreadNotificationCount } from './api';
import { useAuth } from './auth';
import { supabase } from './supabase';

const DAY = 24 * 60 * 60 * 1000;

export function useCountries() {
  const query = useQuery({ queryKey: ['countries'], queryFn: listCountries, staleTime: DAY, gcTime: DAY });
  const byCode = useMemo(() => new Map((query.data ?? []).map((c) => [c.code, c])), [query.data]);
  const options = useMemo(
    () => (query.data ?? []).map((c) => ({ value: c.code, label: `${c.flag_emoji} ${c.name}`, description: c.calling_code })),
    [query.data],
  );
  return { ...query, byCode, options };
}

export function useRegions(countryCode: string | null | undefined) {
  return useQuery({
    queryKey: ['regions', countryCode],
    queryFn: () => listRegions(countryCode!),
    enabled: Boolean(countryCode),
    staleTime: DAY,
  });
}

export function useCountryLabel(code: string | null | undefined) {
  const { byCode } = useCountries();
  if (!code) return '';
  const c = byCode.get(code);
  return c ? `${c.flag_emoji} ${c.name}` : code;
}

/** Unread badges, kept fresh by Realtime when available and polling otherwise. */
export function useBadges() {
  const { userId, account } = useAuth();
  const queryClient = useQueryClient();
  const enabled = Boolean(userId) && account?.status === 'active';

  const notifications = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: unreadNotificationCount,
    enabled,
    refetchInterval: 120_000,
  });
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    enabled,
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (!enabled || !userId) return;
    const channel = supabase
      .channel(`badges:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient]);

  const unreadMessages = (conversations.data ?? []).reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0);
  return { unreadNotifications: notifications.data ?? 0, unreadMessages };
}
