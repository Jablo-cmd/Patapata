# Privacy & Data Retention

Draft for legal review. Applicable laws differ by country, e.g. POPIA (South
Africa), NDPA 2023 (Nigeria), Data Protection Act 2019 (Kenya), Data
Protection Act 2012 (Ghana), Law 09-08 (Morocco), and the AU Malabo
Convention where ratified. A lawyer must confirm registration duties
(e.g. Information Officer registration under POPIA), cross-border transfer
rules and the hosting region before launch.

## Data inventory

| Data | Why | Who can see it | Retention |
|---|---|---|---|
| Email, password hash | Sign-in, security | Member; admins (email only, for support) | Until account deletion |
| Date of birth | 18+ check; optional age display | Member only (others see age only if allowed) | Until account deletion |
| Profile (name, username, photo, country, bio, city, interests, languages) | Social profile | Per privacy settings | Until edited or deleted |
| Coarse location (~1 km), optional | Distance bands | Nobody directly; distance bands only | Until turned off (deleted immediately) or account deletion |
| Posts, comments, likes, photos | Social feed | Per audience | Until deleted by member/moderator or account deletion |
| Messages and attachments | Messaging | Conversation members | Until deleted by sender or account deletion |
| Dating preferences, likes, matches | Optional dating | Member (likes are private) | Until the member leaves dating or deletes the account |
| Reports and evidence snapshots | Safety | Reporter (status), moderators | Kept for the life of the report; review annually (see below) |
| Moderation actions, appeals | Accountability | Affected member, moderators | Minimal record kept after account deletion (target id becomes null) |
| Rate-limit counters | Abuse prevention | Nobody | Purged after 2 days |
| Age-gate failure (user id + time, no date) | Prevent retrying the age gate | Nobody | Until the auth account is deleted |

Not collected: identity documents, phone contacts, precise/live location,
advertising identifiers, analytics/tracking SDK data.

## Deletion

1. Member chooses **Delete account** (Settings → Account) and types DELETE.
2. The profile and all content are hidden immediately (status
   `deactivated`), dating is switched off.
3. The member can cancel by signing in within **14 days**.
4. After 14 days the `purge-deleted-accounts` Edge Function deletes their
   files (avatars, post photos, message attachments) and the auth user,
   which cascades to every row they own: profile, private data, posts,
   comments, likes, messages, friendships, dating data, notifications,
   meetups and responses.
5. Moderation records keep the action and reason but lose the link to the
   person (foreign keys set to null), except reports that are still open.

Deactivation without deletion hides the account until the member returns.

## Open items before launch

- Choose the hosting region (Supabase currently has no region in Africa;
  confirm the closest compliant option and transfer safeguards).
- Appoint an Information Officer / DPO where required.
- Define the retention period for closed reports (proposal: 2 years,
  then anonymise evidence).
- Data subject request process (access/export): an export RPC is a planned
  addition; until then handled manually by an admin.
- Finalise the in-app Privacy Policy (`src/content/legal.ts`).
