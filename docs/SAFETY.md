# Safety & Moderation Operations

This is an operating draft. Before launch it must be reviewed with legal
counsel for each country of operation and assigned to named people.

## Tools

- **Report** — members can report users, posts, comments, messages and
  meetups. A snapshot of the content is stored with the report, so evidence
  survives deletion and moderators never need access to whole conversations.
- **Block** — immediate, silent, two-way invisibility; removes friendships,
  pending requests, dating likes/matches and notifications.
- **Moderator dashboard** (`/admin`, staff only): metrics, priority queue,
  report detail, remove/restore content, warn, suspend (1–30 days), ban
  (admins only), reinstate, appeals, member search, staff roles.
- **Audit log** — every action is a row in `moderation_actions` with the
  moderator, reason and time. The member is notified with the reason.

## Priorities

| Priority | Reasons | Target first response |
|---|---|---|
| Urgent | Threat of violence, child safety, self-harm, under 18 | As soon as possible, at most a few hours, 7 days a week |
| High | Harassment, hate, sexual content, scams, impersonation, private information | Within 24 hours |
| Normal | Spam, other | Within 72 hours |

Posts reported by five or more different members are hidden automatically
until reviewed.

## Standard workflow

1. Open the oldest urgent report, then high, then normal.
2. Read the snapshot, the member's history and related reports.
3. Decide using the Community Guidelines. Write a clear reason — the member
   sees it.
4. Act: dismiss, remove content, warn, suspend or (admin) ban. Prefer the
   least severe action that stops the harm; escalate for repeat offences.
5. Appeals are reviewed by a **different** moderator (enforced). Overturning
   restores content or reinstates the account automatically.

## Credible threats to life

1. Suspend the account immediately (prevents further contact) and keep the
   report open as evidence.
2. Do not delete content — the evidence snapshot and audit log must be kept.
3. Escalate to the designated safety lead, who decides whether to contact
   law enforcement in the relevant country and handles lawful data requests.
4. Record the escalation in the report's resolution note.

## Child-safety concerns

1. Suspend or ban the account and remove the content; never download,
   copy or forward suspected child sexual abuse material.
2. Escalate immediately to the safety lead. Reporting obligations differ by
   country (e.g. South Africa's Films and Publications Act and Children's
   Act). Where available, report to the national hotline or law enforcement
   and to NCMEC/IWF-affiliated hotlines as advised by counsel.
3. Preserve evidence as required by law; restrict access to the safety lead.
4. Before launch, evaluate a hash-matching service for uploaded images.

## Under-18 accounts

Reports with reason "under 18" are urgent. If the account appears to belong
to a minor, ban it with reason "under 18" (the member can appeal with
proportionate evidence of age). Dating is never available to minors.

## Self-harm

Respond with care: keep the account active unless it endangers others, and
(before launch) add country-specific helpline information to the app.

## Meetup safety

In-app guidance (`/legal/safety`) is shown on meetup and dating screens:
meet in public, tell someone, arrange your own transport, leave any time.
Venues are optional, shown only to attendees by default, and must be public
places.

## Staffing before launch

- At least two moderators (so appeals can be independent) and one admin.
- Grant roles: the first admin is created by running, in the SQL editor,
  `insert into public.staff_roles (user_id, role) values ('<uuid>', 'admin');`
  further roles are granted in the dashboard.
- Moderator wellbeing: rotation for urgent queues and access to support.
