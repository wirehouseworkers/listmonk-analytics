# SCHEMA.md — listmonk tables the dashboard reads

Curated subset of listmonk **v6.1.0** schema (verified against `knadh/listmonk`
`master`). This is the single source of truth for column names used by
listmonk-analytics. **Read-only. The dashboard never writes to any of these.**

Only columns the dashboard actually queries are listed. Full schema:
https://github.com/knadh/listmonk/blob/master/schema.sql

---

## campaigns
The core campaign record. Stats columns are maintained by listmonk itself.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `uuid` | uuid | |
| `name` | TEXT | |
| `subject` | TEXT | |
| `status` | campaign_status enum | `draft, running, scheduled, paused, cancelled, finished` |
| `type` | campaign_type enum | `regular, optin` — **exclude `optin` from engagement stats** |
| `to_send` | INT | Intended recipient count at send time |
| `sent` | INT | **Messages actually sent. This is the denominator for open/click rate.** |
| `started_at` | TIMESTAMPTZ | When sending began — anchor for "time since send" curves |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Correctness notes**
- Rate denominator = `sent`, not `to_send`. A campaign mid-send has `sent` < `to_send`.
- `sent = 0` → guard against divide-by-zero; report rate as null/"—", not 0%.
- Engagement analytics should consider only `type = 'regular'` campaigns by default.

---

## campaign_views
One row per open event (tracking pixel hit).

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `campaign_id` | INT FK → campaigns | NOT NULL |
| `subscriber_id` | INT FK → subscribers | **NULLABLE** — null when individual tracking is off, or subscriber deleted |
| `created_at` | TIMESTAMPTZ | Timestamp of the open |

**Correctness notes**
- **Total opens** = `COUNT(*)`. **Unique opens** = `COUNT(DISTINCT subscriber_id)`
  — but unique is only meaningful when `subscriber_id` is populated
  (individual tracking on). With tracking off, report total opens only.
- Open rate = unique-or-total opens / `campaigns.sent`. State which numerator
  the UI uses; listmonk's own UI uses distinct subscribers ("Reach").

---

## links
Distinct URLs that appeared in campaigns (deduplicated globally).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `uuid` | uuid | |
| `url` | TEXT UNIQUE | The destination URL |
| `created_at` | TIMESTAMPTZ | |

---

## link_clicks
One row per click event.

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `campaign_id` | INT FK → campaigns | **NULLABLE** (link may be clicked outside a campaign context) |
| `link_id` | INT FK → links | NOT NULL |
| `subscriber_id` | INT FK → subscribers | **NULLABLE** — same rules as campaign_views |
| `created_at` | TIMESTAMPTZ | Timestamp of the click |

**Correctness notes**
- Per-link breakdown: join `link_clicks.link_id = links.id`, filter by
  `campaign_id`, group by `links.url`.
- Click rate = clicks / `campaigns.sent`. CTOR (click-to-open) =
  unique clicks / unique opens — only valid with individual tracking on.

---

## bounces
Bounce and complaint events. May be absent on very old installs (probe for it).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `subscriber_id` | INT FK → subscribers | NOT NULL |
| `campaign_id` | INT FK → campaigns | **NULLABLE** |
| `type` | bounce_type enum | `soft, hard, complaint` — **complaints are spam reports, track separately** |
| `source` | TEXT | e.g. SES, mailgun, etc. |
| `created_at` | TIMESTAMPTZ | |

**Correctness notes**
- Bounce rate = bounces / `campaigns.sent`. Keep `complaint` separate from
  `soft`/`hard` — complaint rate is a deliverability red flag and should never
  be folded into a generic "bounce rate."

---

## subscribers
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `email` | TEXT UNIQUE | Do not expose in aggregate views; PII |
| `name` | TEXT | PII |
| `status` | subscriber_status enum | `enabled, disabled, blocklisted` |
| `created_at` | TIMESTAMPTZ | Anchor for list-growth-over-time |

**Correctness notes**
- Subscriber-level panels (engagement scoring) expose PII (email/name) — gate
  behind dashboard auth and behind the individual-tracking capability flag.

---

## lists / subscriber_lists
For list-growth and per-list breakdowns.

**lists**: `id`, `name`, `type` (`public/private/temporary`), `status` (`active/archived`).

**subscriber_lists** (join table): `subscriber_id`, `list_id` (NULLABLE),
`status` (`unconfirmed/confirmed/unsubscribed`), `created_at`.

**Correctness notes**
- "Active subscribers on a list" = `subscriber_lists.status = 'confirmed'`
  (for double opt-in) — but single opt-in lists use `unconfirmed` as the
  active state. Check `lists.optin` before assuming. Report cautiously.

---

## Materialized views (present on v6.1.0, do NOT depend on)
`mat_dashboard_counts`, `mat_dashboard_charts`, `mat_list_subscriber_stats`
exist but are refreshed on a cron (listmonk's slow-query cache). The dashboard
queries **raw tables directly** for real-time accuracy, which is more current
than listmonk's own UI when slow-query caching is enabled. Do not read the
mat views except as an explicit, documented fallback.

---

## Cross-cutting correctness rules
1. **Denominator is always `campaigns.sent`** for rates; guard `sent = 0`.
2. **`subscriber_id` is nullable everywhere** — every per-subscriber query must
   handle nulls and must be gated behind the `IndividualTracking` capability.
3. **Exclude `optin` campaigns** from engagement stats unless explicitly asked.
4. **Complaints ≠ bounces** — always separated.
5. **Reconcile against listmonk's own UI** for at least 3 campaigns before any
   metric is marked done.
6. **PII (email/name) only in auth-gated, subscriber-level views.**
