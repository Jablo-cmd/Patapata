/**
 * Public runtime configuration. Only values that are safe to ship inside the
 * app belong here: the Supabase URL and the publishable (anon) key. Access is
 * enforced by Row Level Security, never by keeping these secret.
 *
 * NEVER put the service-role/secret key in an EXPO_PUBLIC_ variable.
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  termsVersion: '2026-10',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
