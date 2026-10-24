# Infrastructure Costs (honest estimate)

Patapata is free for members, but running it is **not free** beyond small
scale. Prices below were collected from third-party summaries in October 2026
because supabase.com was unreachable from the build environment. **Verify on
https://supabase.com/pricing and https://expo.dev/pricing before budgeting** —
sources disagreed on free-tier file storage (500 MB vs 1 GB).

## Supabase

| | Free | Pro (≈ $25/month per org, incl. $10 compute credit) |
|---|---|---|
| Database | 500 MB | 8 GB included, then ≈ $0.125/GB |
| File storage | 500 MB – 1 GB (verify) | 100 GB included, then ≈ $0.021/GB |
| Egress (downloads) | ≈ 5 GB | ≈ 250 GB included, then ≈ $0.09/GB |
| Monthly active users | 50,000 | 100,000 included, then ≈ $0.00325/MAU |
| Projects | 2; **paused after 1 week of inactivity** | Not paused; daily backups |
| Edge Functions, Realtime | Limited quotas | Higher quotas, metered beyond |

What happens at the limits: on Free, exceeding quotas can restrict the
project (e.g. read-only database or blocked egress) and inactive projects are
paused — unacceptable for production. On Pro, usage beyond the included
quota is billed unless a **spend cap** is enabled (then services are limited
instead of billed).

**Recommendation:** Free for development; a separate Pro project for
staging/production once real people use it. Enable the spend cap at first.

## Rough usage model

Assumptions per monthly active member: 2 posts with 1 photo (~150 KB after
compression), 40 messages, viewing ~300 images (~45 MB of egress), 0.5 MB of
database rows.

| Members (MAU) | Storage growth / month | Egress / month | DB growth / month | Likely plan |
|---|---|---|---|---|
| 500 (pilot) | ~150 MB | ~22 GB | ~250 MB | Pro needed for egress (Free ≈ 5 GB) |
| 5,000 | ~1.5 GB | ~225 GB | ~2.5 GB | Pro, near egress quota |
| 50,000 | ~15 GB | ~2.2 TB | ~25 GB | Pro + ≈ $180/month egress + compute upgrade (≈ $60–$110/month) + storage/db overage → ≈ $300–$400/month |

Egress (image views) dominates. Cost levers already in place: client-side
compression, small avatars (512 px), disk caching of images, paginated feeds,
no autoplay media. Further levers: a CDN with caching for public avatars,
WebP, lower-resolution thumbnails, and image-transformation services (Pro
add-on, metered).

## Other costs

| Item | Cost |
|---|---|
| Google Play developer account | One-time ≈ $25 |
| Apple Developer Program | ≈ $99/year (only if shipping on iOS) |
| Expo EAS Build | Free tier has a limited number of low-priority builds per month; paid plans from ≈ $19/month (verify) |
| Transactional email (SMTP) | Many providers have free tiers of a few thousand emails/month; then ≈ $10–$20/month |
| SMS phone verification (optional) | Per-message pricing varies widely by African country (often $0.02–$0.10+ per SMS). **Not enabled.** |
| Domain | ≈ $10–$40/year (not purchased) |
| Web hosting for the static web app | Free tiers on most static hosts |
| Moderation staff | The largest real cost at scale — plan for it |

No paid service has been activated and nothing has been purchased.
