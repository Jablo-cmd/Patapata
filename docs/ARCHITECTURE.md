# Patapata — Architecture

> Working brand name. Trademark, domain and app-store name availability have
> **not** been checked. Do not launch publicly before brand clearance and the
> owner's explicit approval.

## 1. Repository findings (Phase 1 audit, 2026-10-24)

- The repository contained only a two-line `README.md` ("social network app")
  and an initial commit. There was no existing code, framework, deployment
  configuration, CI or secrets, so nothing had to be preserved or migrated.
- With no established stack, the recommended stack was adopted: **Expo SDK 58
  (React Native 0.88, React 19.3) + TypeScript + Expo Router**, and
  **Supabase** (Auth, Postgres with RLS, Storage, Realtime, Edge Functions).
- Blockers found in this build environment (not in the product):
  `api.expo.dev` and `docs.expo.dev` were unreachable through the sandbox
  network policy, so `expo install` was run in offline mode (it resolves
  SDK-compatible versions from the locally bundled version table) and Expo APIs
  were checked against the installed type definitions.

## 2. System architecture

```
 Android / iOS app (Expo)      Web app (same codebase, static export)
            │                                │
            └──────────── HTTPS ─────────────┘
                              │
                     Supabase project
   ┌──────────────┬───────────┴────────┬──────────────┬─────────────────┐
   │ Auth (GoTrue)│ PostgREST (Data API)│ Storage (S3) │ Realtime (WS)   │
   │ email + code │ tables + RPCs       │ 3 buckets    │ messages,       │
   │ verification │ guarded by RLS      │ + policies   │ notifications   │
   └──────────────┴──────────┬──────────┴──────────────┴─────────────────┘
                             │
                PostgreSQL 17 (+ PostGIS, pg_trgm, pg_cron)
          public schema: tables, RLS policies, SECURITY DEFINER RPCs
          app schema (not exposed): permission helpers, rate limits, queues
                             │
           Edge Functions (service role, scheduled):
           purge-deleted-accounts (daily) · cleanup-storage (hourly)
```

Key decisions:

| Decision | Why |
|---|---|
| One Expo codebase for Android, iOS and web | Cheapest to build and maintain; the web build doubles as the moderator console and for early testing. |
| All authorisation in Postgres (RLS + RPCs) | The client is untrusted. Hiding buttons is only UX. Every rule is enforced and tested in the database. |
| Private `app` schema for helpers | Helper functions used by policies cannot be called directly through the API. |
| Column-level grants on sensitive tables | Row Level Security cannot hide columns; e.g. clients can read a profile *card* but not bio/city directly — full profiles come from `get_profile()`, which applies privacy settings. |
| `SECURITY DEFINER` RPCs for multi-step writes | Friend requests, posting with media, reports, moderation and dating decisions need validation across tables. Each re-checks the caller. |
| `SECURITY INVOKER` for the feed | `get_feed` relies on the same RLS policies as direct reads, so there is one source of truth for visibility. |
| Email + 6-digit code (OTP) verification | Works when the email is opened on another device and needs no deep-link setup. Links still work too. |
| No SMS dependency | Phone verification needs a paid SMS provider; see `docs/DEPLOYMENT.md`. The app is fully usable without it. |
| Client-side image compression | Photos are resized (≤1280 px) and re-encoded as JPEG before upload: smaller uploads on limited data and EXIF (incl. GPS) removed. |
| Coarse location only | Coordinates are rounded to ~1 km in the database before storage and only ever returned as distance bands ("10–25 km"). |
| System fonts, no analytics SDKs, no ads | Small downloads, no third-party tracking, no monetisation (per the free-for-everyone rule). |

### App structure

```
src/
  app/                    Expo Router routes (every file is a screen)
    _layout.tsx           providers + gate: signed-out → onboarding → restricted → app
    (auth)/               welcome, sign-up, verify (code), sign-in, forgot-password
    onboarding.tsx        18+ gate, username, country, interests
    account-status.tsx    under-18 / deactivated / suspended / banned (+ appeal)
    (app)/(tabs)/         Home · Discover · Create · Messages · Profile
    (app)/…               post, user, chat, friends, meetups, dating, notifications,
                          search, report, settings/*, admin/* (moderators)
    legal/[doc].tsx       guidelines, safety tips, privacy policy, terms (drafts)
  components/             PostCard, FeedList, ProfileView, ui/ (design system)
  lib/                    api.ts (typed data access), auth.tsx, media.ts, errors.ts,
                          validation.ts, database.types.ts (generated)
  theme/                  design tokens
supabase/
  migrations/             schema, RLS, RPCs (apply in order)
  tests/                  pgTAP security tests
  functions/              Edge Functions
  templates/              branded auth emails with codes
tests/                    unit, integration (local Supabase) and browser e2e
```

## 3. MVP scope and implementation order

Implemented in this order (all phases are wired to real data — no mock data):

1. **Foundation** — schema, RLS, helpers, rate limits, reference data (54
   African countries with calling codes; regions for ZA, NG, GH, KE).
2. **Identity** — email sign-up, code verification, password reset,
   onboarding with 18+ gate, profiles, privacy settings, account
   deactivation/deletion.
3. **Social core** — posts (text, up to 6 photos, audiences), comments with
   one level of replies, likes, reshares (public posts only), mentions,
   keyset-paginated feeds (Friends / Across Africa / profile / search).
4. **Connections** — friend requests, blocks, suggestions, cross-border
   discovery with filters (country, region, city, interests, languages, age,
   intent, approximate distance), search.
5. **Messaging & notifications** — direct conversations, photo attachments,
   Realtime delivery, unread counts, in-app notifications with preferences.
6. **Meetups & dating** — chill invites and scheduled meetups with venue
   privacy and capacity; opt-in dating with private likes, mutual matches,
   unmatch, and erase-dating-data.
7. **Safety** — reports (with evidence snapshots), moderator dashboard,
   content removal, warnings, suspensions/bans, appeals by an independent
   moderator, audit log.

Out of scope for this MVP (candidates for next iterations): push
notifications delivery (preferences are stored; needs EAS push credentials),
group chats/communities, video, translations beyond English, phone
verification, captcha (config-ready), email digests.

## 4. Database design

All tables have RLS enabled. `→` = foreign key. Timestamps are `timestamptz`.

| Table | Purpose & key rules |
|---|---|
| `countries`, `regions` | Reference data. Readable by everyone. |
| `profiles` | 1:1 with `auth.users`. Public card (username, name, avatar, country) + profile content. Username unique (case-insensitive), `[a-z0-9_]{3,30}`, reserved names blocked. `status` ∈ pending/active/suspended/banned/deactivated (only changeable via RPCs). |
| `profile_private` | Birth date, coarse location, terms acceptance. Owner-only. |
| `user_privacy_settings` | Profile/friends-list visibility, show age/city, discoverable, who can friend/message, location toggle. |
| `notification_preferences` | Per-type toggles; security and moderation notices always on. |
| `staff_roles` | moderator / admin. Granted only by admins (audited). |
| `friendships` | One row per pair (unique on the unordered pair), pending/accepted. Writes via RPCs only. |
| `blocks` | Blocker-only visibility. Blocking removes friendships, notifications, dating likes and matches. |
| `posts` | Body ≤ 5,000 chars, audience public/friends/only_me, reshare pointer, counters, idempotency key, moderation status. |
| `post_media` | Up to 6 per post; path must be in the author's storage folder and actually uploaded. |
| `comments` | ≤ 2,000 chars, one reply level, removable by author or post owner. |
| `post_reactions` | One like per member per post. |
| `conversations`, `conversation_members`, `messages` | Direct conversations (unique per pair). Only members can read or send; sending re-checks blocks and messaging privacy. |
| `notifications` | Created only by triggers/RPCs; recipient-only access. |
| `dating_preferences`, `dating_swipes`, `dating_matches` | Opt-in profile, private likes/passes, mutual matches. |
| `meetups`, `meetup_responses` | Venue columns not directly readable; `list_meetups()` reveals them per `venue_visibility`. Capacity enforced. |
| `reports`, `moderation_actions`, `appeals` | Reports with evidence snapshot and priority; append-only audit log; one appeal per decision. |
| `app.rate_limits`, `app.storage_deletion_queue`, `app.age_gate_failures` | Private operational tables. |

Indexes cover every foreign key used in lookups, keyset feed ordering,
trigram search on usernames/names, GIN on interests/languages and full-text
search on posts and meetups, and a GiST index on coarse location.

## 5. Testing

| Layer | Command | Covers |
|---|---|---|
| Database (pgTAP, 124 tests) | `npm run test:db` | RLS for every table as several users, forged writes, column privacy, age gate, blocking, messaging privacy, dating privacy, venue privacy, moderation permissions, account lifecycle. |
| Unit (Vitest) | `npm test` | Validation, formatting, error mapping. |
| Integration (Vitest, local stack) | `npm run test:integration` | Real sign-up with emailed code, password reset, private media access, upload restrictions, Realtime delivery to members only, venue privacy, cross-border dating, admin gating, Edge Function purge and cleanup. |
| Browser (Playwright, web build) | `node tests/e2e/web-walkthrough.cjs` | Full journey in a 390×844 viewport: sign-up → code → onboarding → explore → friend request → post with photo → realtime chat → discover → meetup → dating → profile → settings, dark mode and desktop. Fails on any console error. |
| Static | `npm run typecheck`, `npm run lint` | TypeScript strict, Expo ESLint incl. React Compiler rules. |

Not yet tested on physical Android/iOS devices (no device or EAS build was
available in this environment) — see `docs/DEPLOYMENT.md`.
