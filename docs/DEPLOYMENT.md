# Deployment Guide (staging first)

Nothing has been deployed. These are the manual steps for the owner; each
requires your own accounts and approval.

## 1. Create a Supabase staging project

1. Create a project at supabase.com (choose the region; see `docs/PRIVACY.md`).
2. Link and push the schema from this repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations in order
   ```
   `db push` only applies new migrations; it never resets data.
3. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy purge-deleted-accounts
   npx supabase functions deploy cleanup-storage
   ```
4. Auth settings (Dashboard → Authentication):
   - Site URL: your web URL; Redirect URLs: `patapata://auth-callback`,
     `https://<web-domain>/auth-callback`.
   - Email: enable confirmations; minimum password length 10, letters+digits.
   - Paste the templates from `supabase/templates/` (they include the
     6-digit `{{ .Token }}` the app asks for).
   - Configure custom SMTP (required for real users).
   - Enable CAPTCHA before public launch.
5. Schedule the maintenance functions (SQL editor; uses `pg_cron` + `pg_net`,
   storing the service key in Vault — never in code):
   ```sql
   create extension if not exists pg_net;
   select vault.create_secret('<service-role-key>', 'service_role_key');
   select cron.schedule('purge-deleted-accounts', '30 2 * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/purge-deleted-accounts',
       headers := jsonb_build_object('Authorization', 'Bearer ' ||
         (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')));
   $$);
   select cron.schedule('cleanup-storage', '15 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/cleanup-storage',
       headers := jsonb_build_object('Authorization', 'Bearer ' ||
         (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')));
   $$);
   ```
6. Create the first admin (after signing up and onboarding in the app):
   ```sql
   insert into public.staff_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com';
   ```
7. Run Security Advisor and Performance Advisor in the dashboard.

## 2. Configure the app

Set public values per environment (EAS environment variables or
`.env.local`):

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
EXPO_PUBLIC_SUPPORT_EMAIL=<support address>
```

## 3. Android build (EAS)

Requires an Expo account. Bundle id `africa.patapata.app` in `app.json` is a
**placeholder** — change it before the first store upload (it cannot be
changed afterwards).

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # links the project, adds projectId
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
npx eas-cli@latest build -p android --profile preview      # installable APK for testers
npx eas-cli@latest build -p android --profile production   # AAB for Google Play
```

Local alternative (needs Android Studio): `npx expo run:android`.

Test on a low-end Android device (2–3 GB RAM) on a throttled 3G connection
before release.

## 4. Web build

```bash
npm run build:web     # outputs dist/ (static single-page app)
```

Host `dist/` on any static host with an SPA fallback to `index.html`.

## 5. Google Play submission checklist

- [ ] Brand clearance done; final app name, icon and bundle id approved.
- [ ] Privacy Policy published at a public URL (from `src/content/legal.ts`,
      after legal review).
- [ ] Data safety form: collects email, name, photos, user content, messages,
      approximate location (optional), date of birth; no data sold or shared
      for ads; data encrypted in transit; users can request deletion
      (in-app + a web URL for deletion requests is required by Play).
- [ ] Content rating questionnaire: social networking with user-generated
      content, user interaction, dating features → expect an adult rating;
      target audience 18+.
- [ ] Account deletion URL (Play requirement) — publish instructions page.
- [ ] Screenshots (phone): see `docs/screenshots/` for current UI; feature
      graphic 1024×500; icon 512×512 from `assets/brand/icon.png`.
- [ ] Moderation contacts and processes in place (`docs/SAFETY.md`).

## Remaining manual steps (owner)

1. Brand/trademark/domain clearance for "Patapata".
2. Create Supabase (staging, then production) and Expo accounts.
3. SMTP provider, CAPTCHA keys.
4. Legal review of Terms, Privacy Policy, Community Guidelines per country.
5. Recruit and train moderators; name a safety lead.
6. Decide whether to enable phone verification (paid SMS).
7. Device testing on Android hardware and accessibility review with
   TalkBack.
8. Professional translations (French, Portuguese, Swahili, isiZulu,
   isiXhosa, …) — strings are currently English only.
