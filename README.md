# Patapata — Africa Connects Here.

*Your People. Your Stories. Your Africa.*

Patapata is a free, pan-African social network: share your life, make friends
anywhere on the continent, organise meetups and — only if you choose — date.
No subscriptions, no paid boosts, no paywalls, no ads.

> **Status: working MVP, not launched.** "Patapata" is a working name; brand,
> trademark, domain and app-store availability have not been checked. Nothing
> has been deployed or published. See [Deployment](docs/DEPLOYMENT.md) for the
> remaining manual steps.

| Welcome | Onboarding | Feed | Realtime chat | Discover | Dark mode |
|---|---|---|---|---|---|
| ![](docs/screenshots/01-welcome.jpg) | ![](docs/screenshots/03-onboarding.jpg) | ![](docs/screenshots/09-home-feed.jpg) | ![](docs/screenshots/11-chat-realtime.jpg) | ![](docs/screenshots/12-discover.jpg) | ![](docs/screenshots/17-home-dark.jpg) |

## Features

- **Accounts** — email sign-up with a 6-digit emailed code, password reset by
  code, 18+ onboarding (date of birth kept private), deactivation, deletion
  with a 14-day grace period.
- **Profiles** — photo, cover, bio, country/region/city, languages,
  interests, hobbies, intents; privacy settings for every field that matters.
- **Feed** — text and photo posts (up to 6, compressed on device), audiences
  (everyone / friends / only me), comments and replies, likes, reshares,
  @mentions, edit/delete, reports; Friends and "Across Africa" feeds.
- **Friends** — requests, accept/decline/cancel, remove, block,
  suggestions (mutual friends, shared interests, nearby).
- **Discover & search** — people anywhere in Africa by country, region,
  city, interests, languages, age, intent and optional approximate distance;
  search people, posts and meetups.
- **Messaging** — private conversations with photos, realtime delivery,
  unread counts, delete, report, block. Not end-to-end encrypted (and the
  app says so).
- **Meetups & chill** — open invites or scheduled meetups, public venues
  shown only to attendees by default, capacity, RSVPs, cancellations.
- **Dating (optional)** — off by default, adults only, private likes,
  mutual matches, unmatch, hidden from your social profile unless you choose.
- **Notifications** — friend requests, likes, comments, replies, mentions,
  messages, meetups, matches, security and moderation notices; per-type
  preferences; realtime badges.
- **Safety & moderation** — reports with evidence snapshots, priority queue,
  moderator dashboard, warnings, suspensions, bans, appeals reviewed by a
  different moderator, audit log, safety guidance.

## Tech stack

Expo SDK 58 (React Native 0.88, TypeScript, Expo Router) for Android, iOS
and web · Supabase (Postgres 17 with Row Level Security, Auth, Storage,
Realtime, Edge Functions) · TanStack Query · Vitest, pgTAP, Playwright.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and database
schema.

## Run it locally

Prerequisites: Node 20+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start                 # local Postgres, Auth, Storage, Realtime, Mailpit
cp .env.example .env.local         # then paste the anon key from `npx supabase status`
npx supabase functions serve       # optional: Edge Functions (separate terminal)
npm run web                        # or: npm run android / npm run ios
```

Sign-up emails (with the verification code) arrive in the local inbox at
http://127.0.0.1:54324. On an Android emulator, use your computer's LAN IP
instead of 127.0.0.1 in `.env.local`.

To make yourself a moderator locally:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into staff_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run typecheck` / `npm run lint` | TypeScript strict / Expo ESLint |
| `npm test` | Unit tests |
| `npm run test:db` | 124 pgTAP security tests (RLS, permissions, privacy) |
| `npm run test:integration` | API journeys against the local stack (needs functions served) |
| `node tests/e2e/web-walkthrough.cjs` | Browser walkthrough of the web build (see file header) |
| `npm run db:reset` | Recreate the local database from migrations |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `npm run build:web` | Static web build in `dist/` |
| `npm run brand:assets` | Regenerate icons from `scripts/generate-brand-assets.py` |

## Documentation

- [Architecture & database](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Safety & moderation operations](docs/SAFETY.md)
- [Privacy & data retention](docs/PRIVACY.md)
- [Costs & free-tier limits](docs/COSTS.md)
- [Deployment & Android build](docs/DEPLOYMENT.md)

## Rules this project keeps

Free for every member, forever: no subscriptions, premium tiers, boosts,
credits, paywalls, in-app purchases, ads or data sales without the owner's
explicit approval. Permissions are enforced in the database, not the UI.
No secrets in the repository.
