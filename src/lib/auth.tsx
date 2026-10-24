import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getAccountState, touchLastActive } from './api';
import { isConfigured } from './config';
import { supabase } from './supabase';
import type { AccountState } from './types';

type AuthContextValue = {
  initializing: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  account: AccountState | null | undefined;
  accountLoading: boolean;
  accountError: unknown;
  refreshAccount: () => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyRecoveryCode: (email: string, code: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const redirectTo = () => Linking.createURL('/auth-callback');

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const accountQuery = useQuery({
    queryKey: ['account-state', userId],
    queryFn: getAccountState,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  // Lightweight presence heartbeat while the app is open.
  useEffect(() => {
    if (!userId || accountQuery.data?.status !== 'active') return;
    touchLastActive().catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') touchLastActive().catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId, accountQuery.data?.status]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) throw error;
    return { needsVerification: !data.session };
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
    if (error) throw error;
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) throw error;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
    if (error) throw error;
  }, []);

  const verifyRecoveryCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      userId,
      email: session?.user.email ?? null,
      account: accountQuery.data,
      accountLoading: accountQuery.isLoading,
      accountError: accountQuery.error,
      refreshAccount: accountQuery.refetch,
      signIn,
      signUp,
      verifyEmailCode,
      resendVerification,
      requestPasswordReset,
      verifyRecoveryCode,
      updatePassword,
      signOut,
    }),
    [
      initializing,
      session,
      userId,
      accountQuery.data,
      accountQuery.isLoading,
      accountQuery.error,
      accountQuery.refetch,
      signIn,
      signUp,
      verifyEmailCode,
      resendVerification,
      requestPasswordReset,
      verifyRecoveryCode,
      updatePassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in member's id; screens behind the auth guard can rely on it. */
export function useUserId(): string {
  const { userId } = useAuth();
  if (!userId) throw new Error('not_authenticated');
  return userId;
}
