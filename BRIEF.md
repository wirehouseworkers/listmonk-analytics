# listmonk-analytics — Project Brief

## What this is

A standalone, read-only analytics dashboard for [listmonk](https://listmonk.app).
It connects to listmonk's existing Postgres database, reads the engagement data
listmonk already records (views, clicks, bounces), and surfaces the analytics
listmonk's built-in UI does not: time-series engagement curves, link-level
breakdowns, subscriber engagement scoring, and deliverability trends.

It modifies nothing. It writes nothing. It is a separate service that any
listmonk operator can point at their database and run.

## Why it exists

listmonk records rich engagement data but surfaces only thin per-campaign
aggregates in its admin UI. The underlying tables (`campaign_views`,
`link_clicks`, `bounces`) contain far more than the UI exposes. This tool reads
that data and answers questions listmonk can't:

- How does engagement decay in the hours/days after a send?
- Which links in a campaign actually got clicked, and how much?
- Who are my most-engaged subscribers? Who's gone cold?
- Are my bounce/complaint rates trending up over time?
- How do campaigns compare against each other on open/click/bounce rate?

## Design principles (non-negotiable)

1. **Read-only.** Connects with a read-only Postgres role. Never writes to
   listmonk's database. Cannot corrupt a production install.
2. **Zero modification to listmonk.** No forks, no plugins, no schema changes,
   no migrations. listmonk is untouched.
3. **One integration point.** A single `DATABASE_URL` environment variable.
   Nothing else is required to run.
4. **Version-tolerant.** Probes the connected database at startup to detect
   which tables/columns/views exist, and degrades gracefully on older listmonk
   versions instead of crashing.
5. **Single binary, embedded UI.** Ships as one Go binary with the entire
   frontend embedded. No Node runtime, no separate web server, no
   `node_modules`. Download, set one variable, run.
6. **Portable.** Runs on Railway, a VPS, Docker, or localhost identically.
   No host-specific assumptions.
7. **Free and open.** MIT licensed, donation-optional, built to be given away.

## Architecture

```
┌─────────────────────┐         read-only          ┌──────────────────┐
│  listmonk-analytics │ ──────────────────────────▶ │ listmonk Postgres │
│   (single Go binary)│   SELECT-only queries       │  (unchanged)      │
│                     │                             └──────────────────┘
│  ┌───────────────┐  │
│  │ embedded web  │  │   HTTP (optional basic auth)
│  │ UI (HTML/JS/  │  │ ◀───────────────────────────  Browser
│  │ Chart.js)     │  │
│  └───────────────┘  │
└─────────────────────┘
```

- **Language:** Go (matches listmonk's own single-binary idiom).
- **DB driver:** pgx (read-only pool).
- **Frontend:** Vanilla HTML/CSS/JS + Chart.js, embedded via Go's `embed`.
  No build step, no framework — keeps the binary self-contained and the code
  approachable for contributors.
- **Auth:** Optional HTTP basic auth via `DASHBOARD_USER` / `DASHBOARD_PASS`.
- **Config:** Environment variables only.

## Phase 1 features (this build)

| Feature | Data source | Notes |
|---|---|---|
| Overview KPIs | `campaigns`, `bounces` | Totals: sent, views, clicks, bounces + rates |
| Campaign table | `campaigns` + joins | Per-campaign open/click/bounce rate, sortable |
| Engagement curve | `campaign_views`, `link_clicks` | Views & clicks over time since send, per campaign |
| Link breakdown | `link_clicks`, `links` | Click counts per URL within a campaign |
| Subscriber engagement | `campaign_views`, `link_clicks` | Recency/frequency scoring* |
| Bounce & complaint trends | `bounces` | Soft/hard/complaint over time |
| List growth | `subscribers`, `subscriber_lists` | New subscribers over time per list |

\* Subscriber-level scoring requires listmonk's **individual tracking** to be
enabled (`privacy.individual_tracking = true`). If it is off, listmonk records
views/clicks anonymously; the dashboard detects this, hides subscriber-level
panels, and shows aggregate analytics only.

## Phase 1 non-goals (explicitly out of scope)

- Writing/sending/scheduling anything (read-only, forever).
- Mailgun / SES / ESP-side event ingestion (that's Phase 2).
- Send-time optimization, A/B analysis (Phase 2).
- Replacing listmonk's UI or auth (this is a companion, not a fork).
- Multi-tenant SaaS hosting (single-instance tool by design).

## Phase 2 candidates (future, separate project)

- Mailgun Events API ingestion for true delivery/bounce/complaint data.
- Send-time and day-of-week optimization analysis.
- Vendor-rotation / AM-PM scheduling overlays (operator-specific).
- Exportable / shareable report snapshots.

## Deployment targets

- **Primary:** Railway (Dockerfile + `railway.json` provided).
- **Also supported:** any Docker host, bare binary on a VPS, localhost.

## Setup contract (what an adopter does)

1. Create a read-only Postgres role in their listmonk database (SQL provided).
2. Deploy the binary/container.
3. Set `DATABASE_URL` to the read-only connection string.
4. (Optional) Set `DASHBOARD_USER` / `DASHBOARD_PASS` for auth.
5. Open the dashboard.

That's the entire integration. No listmonk changes, no rebuilds.
