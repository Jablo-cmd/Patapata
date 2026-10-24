/**
 * Helpers for integration tests against a local Supabase stack
 * (`npx supabase start`). Never point these at a production project:
 * they create users and use the service-role key.
 */
import { execSync } from 'node:child_process';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../src/lib/database.types';

function localEnv(): Record<string, string> {
  try {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return Object.fromEntries(
      out
        .split('\n')
        .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .map((m) => [m[1], m[2]]),
    );
  } catch {
    return {};
  }
}

const env = localEnv();
export const API_URL = process.env.SUPABASE_URL ?? env.API_URL ?? 'http://127.0.0.1:54321';
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? env.ANON_KEY ?? '';
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY ?? '';
export const MAILPIT_URL = process.env.MAILPIT_URL ?? env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

if (!/127\.0\.0\.1|localhost/.test(API_URL)) {
  throw new Error('Integration tests must only run against a local Supabase stack.');
}

export type Client = SupabaseClient<Database>;

export function anonClient(): Client {
  return createClient<Database>(API_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const service = createClient<Database>(API_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const PASSWORD = 'correct-horse-42';
const run = Date.now().toString(36);

export function uniqueEmail(name: string) {
  return `${name}.${run}@example.test`;
}

export function uniqueUsername(name: string) {
  return `${name}_${run}`.slice(0, 30);
}

/** Polls the local Mailpit inbox for the newest 6-digit code sent to `email`. */
export async function emailCode(email: string, after = 0): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const latest = body.messages.find((m) => new Date(m.Created).getTime() >= after);
    if (latest) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)).json()) as { Text: string; HTML: string };
      const code = (msg.Text || msg.HTML).match(/\b(\d{6})\b/);
      if (code) return code[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email code arrived for ${email}`);
}

export type Member = { client: Client; id: string; username: string; email: string };

/**
 * Creates a confirmed, onboarded member quickly via the admin API (the full
 * email sign-up journey has its own test).
 */
export async function createMember(name: string, opts: { country?: string; birthDate?: string } = {}): Promise<Member> {
  const email = uniqueEmail(name);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  const username = uniqueUsername(name);
  const onboard = await client.rpc('complete_onboarding', {
    p_username: username,
    p_display_name: name[0].toUpperCase() + name.slice(1),
    p_birth_date: opts.birthDate ?? '1995-06-15',
    p_country_code: opts.country ?? 'ZA',
    p_city: 'Johannesburg',
    p_languages: ['en'],
    p_interests: ['football', 'music'],
    p_intents: ['friendship'],
    p_accept_terms: true,
  });
  if (onboard.error) throw onboard.error;
  return { client, id: data.user.id, username, email };
}

export async function makeFriends(a: Member, b: Member) {
  const req = await a.client.rpc('send_friend_request', { p_target: b.id });
  if (req.error) throw req.error;
  const res = await b.client.rpc('respond_friend_request', { p_requester: a.id, p_accept: true });
  if (res.error) throw res.error;
}

/** A tiny valid JPEG (1×1 px). */
export const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
