# Security

## Principles

1. **The database is the security boundary.** Every exposed table has Row
   Level Security; sensitive columns are hidden with column-level grants;
   multi-step writes go through `SECURITY DEFINER` RPCs that re-check the
   caller. The app only hides buttons for convenience.
2. **Least privilege.** The `anon` role can read only country/region reference
   data. Helpers live in a private `app` schema that is not exposed through
   the API. Service-role functions are revoked from `authenticated`.
3. **Secrets never ship in the app.** Only the project URL and publishable
   (anon) key are in `EXPO_PUBLIC_*` variables. The service-role key is used
   only by Edge Functions and operators. `.env*.local` is git-ignored.

## Controls implemented

| Threat | Control | Tested in |
|---|---|---|
| Reading others' messages by changing IDs | RLS: members only, for rows, Realtime events and attachments | pgTAP 03, integration "realtime" |
| Editing/deleting others' posts or comments | RLS update/delete policies; status/counters not client-writable | pgTAP 02 |
| Impersonation (posting/commenting as someone else) | `with check (author_id = auth.uid())`, RPCs use `auth.uid()` | pgTAP 02 |
| Forged friendships, staff roles, account status | No insert/update grants; RPC-only state changes | pgTAP 01, 04 |
| Leaking private profile fields | Column grants + `get_profile()` privacy filtering; birth date owner-only | pgTAP 01 |
| Precise location exposure | Rounded to ~1 km at write time; only distance bands returned | schema |
| Venue/home address exposure | Venue columns not selectable; revealed only per host setting | pgTAP 03, integration |
| Minors | 18+ gate at onboarding (failure recorded, no retry); dating re-checks age; "under 18" report reason is urgent | pgTAP 01 |
| Malicious uploads | Bucket MIME allow-list (JPEG/PNG/WebP), 2–5 MB limits, owner-folder paths, re-encoding client-side, path validation server-side | integration |
| Spam / abuse | Per-user rate limits on posts, comments, likes, messages, friend requests, reports, meetups, dating, discovery; duplicate-post detection; idempotency keys; auto-hide after 5 distinct reports | pgTAP 02 |
| Brute force / bot sign-ups | Supabase Auth rate limits; 10-char passwords with letters and digits; email verification required; **captcha ready to enable** (see below) | integration |
| SQL injection | Parameterised PostgREST/RPC calls; all functions `set search_path = ''` | lint |
| Moderator overreach | Moderators see only the reported item (message snapshot), not conversations; bans and staff changes admin-only; appeals need a different moderator; all actions audited | pgTAP 04 |
| Session theft on device | Sessions in app-sandboxed storage; refresh-token rotation enabled; security notifications on password/email change | integration |

Messages are encrypted in transit (TLS) and at rest by the hosting provider.
They are **not end-to-end encrypted**, and the app never claims otherwise.

## Before any public launch (must do)

- [ ] Enable **CAPTCHA** (hCaptcha or Cloudflare Turnstile, both have free
      tiers) in Supabase Auth and add the token to sign-up/sign-in.
- [ ] Configure a production **SMTP** provider (Supabase's built-in email is
      for testing only and heavily rate-limited).
- [ ] Set Auth site URL and redirect allow-list to the real domains/scheme.
- [ ] Review rate limits against real usage (`admin_metrics` shows heavy hits).
- [ ] Run Supabase **Security Advisor** and **Performance Advisor** on the
      hosted project.
- [ ] Enable leaked-password protection (Pro plan feature) or accept the risk.
- [ ] Independent penetration test / security review.
- [ ] Set up the scheduled Edge Functions (account purge, storage cleanup).
- [ ] Decide incident-response contacts (see `docs/SAFETY.md`).

## Known limitations / residual risks

- Age assurance is self-declared date of birth plus reporting. Stronger,
  proportionate options (e.g. facial age estimation without storing images,
  or verification only when an account is reported as underage) should be
  assessed per country before launch. Identity documents are deliberately not
  collected.
- Avatars and cover photos live in a public bucket (anyone with the exact URL
  can view them). They are part of the public profile card by design.
- Signed URLs for private photos are valid for one hour once issued.
- Rate limiting is per account; IP-level abuse relies on Supabase Auth limits
  and, later, captcha.
- Uploaded image content is not automatically scanned for illegal material.
  A CSAM hash-matching service should be evaluated before launch
  (see `docs/SAFETY.md`).
