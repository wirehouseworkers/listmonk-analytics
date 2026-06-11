# listmonk-analytics

A standalone, **read-only** analytics dashboard for [listmonk](https://listmonk.app).
It connects to listmonk's existing Postgres database and surfaces engagement
analytics that listmonk's built-in UI does not: time-series engagement curves,
per-link breakdowns, subscriber engagement scoring, and deliverability trends.

It modifies nothing in your listmonk install. It writes nothing. It is a
companion service any listmonk operator can point at their database and run.
---

![alt text](listmonk-analytics-amain.PNG "Listmonk Analytics")
---

## Features

| View | What it shows |
|---|---|
| **Campaign comparison table** | All campaigns side-by-side: sent count, open rate, click rate, bounce rate, complaint rate — sortable by any column |
| **Open rate & diagnostics** | Unique opens (tracking-on) or total opens (tracking-off), open rate vs. `sent`, with a note when individual tracking is disabled |
| **Click rate & CTOR** | Click rate vs. `sent`; click-to-open ratio (only shown when individual tracking is on) |
| **Per-link breakdown** | Click counts per URL within a campaign |
| **Engagement curve** | Views and clicks bucketed by hours/days since the campaign sent — shows how engagement decays over time |
| **Bounce & complaint trends** | Global daily soft bounce / hard bounce / complaint counts — complaints are always tracked separately, never folded into a generic bounce rate |
| **List growth** | New subscribers over time; active subscriber count per list |
| **Subscriber engagement scoring** | Recency/frequency scores per subscriber over a configurable window (requires individual tracking + dashboard auth) |

### Tracking-off graceful degradation

If listmonk's `privacy.individual_tracking` is disabled, listmonk records views
and clicks anonymously. The dashboard detects this at startup and hides
subscriber-level panels (engagement scoring, CTOR). Aggregate campaign analytics
work either way.

---
![alt text](listmonk-analytics-campaigns.PNG "Campaigns")
![alt text](listmonmk-analytics-lists-a.PNG "Lists")
![alt text](listmonmk-analytics-subscribers.PNG "Subscribers")


---
## Read-only safety model

The dashboard is physically incapable of modifying your data:

- It connects using a dedicated `analytics_ro` Postgres role that has only
  `SELECT` privileges.
- The pgx connection pool also sets `default_transaction_read_only = on` as a
  second layer of defence — even if a query somehow attempted a write, Postgres
  would reject it.
- No forks, no plugins, no schema changes, no listmonk migrations — listmonk is
  completely untouched.

---

## Setup

### 1. Create the read-only Postgres role

Run `setup/readonly-role.sql` against your listmonk database. The file is
idempotent (safe to re-run). It creates a role named `analytics_ro` with
`SELECT`-only access and sets `default_transaction_read_only = on` on the role.

**On Railway:**

1. Open your Railway project → Postgres service → **Data** (or **Query**) tab.
2. Open `setup/readonly-role.sql`, replace `CHANGE_ME_STRONG_PASSWORD` with a
   strong password, and paste the whole file into the query editor.
3. Run it.

**With psql:**

```sh
psql "$YOUR_LISTMONK_DATABASE_URL" -f setup/readonly-role.sql
```

### 2. Build the `DATABASE_URL` for the dashboard

Take your existing listmonk Postgres connection string and swap in the
`analytics_ro` credentials. Example for Railway internal networking:

```
postgresql://analytics_ro:YOUR_STRONG_PASSWORD@postgres.railway.internal:5432/railway
```

For a local or external connection, use the public host/port instead of the
`.railway.internal` hostname.

**Never commit this URL.** Set it as an environment variable only.

### 3. Deploy

See [Deployment](#deployment) below.

### 4. (Optional) Enable dashboard auth

Set `DASHBOARD_USER` and `DASHBOARD_PASS` to enable HTTP basic auth. This is
required if you want the subscriber engagement view (which exposes email
addresses and names).

### 5. Open the dashboard

Navigate to the service URL. If auth is enabled, your browser will prompt for
the credentials you set.

---

## Deployment

### Railway (recommended)

A `Dockerfile` and `railway.json` are included. Deploy directly from the repo:

1. Create a new Railway service and point it at this repository.
2. Set the `DATABASE_URL` environment variable (and optionally `DASHBOARD_USER`
   / `DASHBOARD_PASS`) in the Railway service's variable settings.
3. Railway builds the Docker image and deploys. The healthcheck at `/health`
   confirms it is up.

The binary listens on the port Railway injects via `$PORT` automatically.

### Docker (any host)

```sh
docker build -t listmonk-analytics .
docker run -e DATABASE_URL="postgresql://analytics_ro:pw@host:5432/dbname" \
           -p 8080:8080 \
           listmonk-analytics
```

### Local binary

```sh
go build -o listmonk-analytics .
DATABASE_URL="postgresql://analytics_ro:pw@localhost:5432/listmonk" ./listmonk-analytics
```

Requires Go 1.22+. The frontend is embedded in the binary — no Node.js, no
build step, no `node_modules`.

---

## Environment variable reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | Postgres connection string. Use the `analytics_ro` read-only role. |
| `LISTEN_ADDR` | No | `:8080` | Full address to listen on, e.g. `0.0.0.0:9000`. Takes precedence over `PORT`. |
| `PORT` | No | `8080` | Port number only. Used when `LISTEN_ADDR` is not set (Railway sets this automatically). |
| `DASHBOARD_USER` | No | — | HTTP basic auth username. Both `DASHBOARD_USER` and `DASHBOARD_PASS` must be set to enable auth. |
| `DASHBOARD_PASS` | No | — | HTTP basic auth password. |
| `ROOT_URL` | No | — | Public base URL of the dashboard (e.g. `https://analytics.example.com`). Not required for normal operation. |
| `ENGAGED_WINDOW_DAYS` | No | `90` | Lookback window in days for subscriber engagement scoring. Must be a positive integer. |

### Subscriber PII & auth

The subscriber engagement view exposes email addresses and subscriber names
(PII). The dashboard **refuses to serve this endpoint** unless both
`DASHBOARD_USER` and `DASHBOARD_PASS` are set. This is enforced in the server,
not just documented — an unauthenticated install physically cannot return
subscriber PII from the API.

If individual tracking is disabled in listmonk, the subscriber engagement view
is additionally hidden in the UI regardless of auth status.

---

## How it works

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

- **Language:** Go 1.22, single static binary.
- **DB driver:** [pgx](https://github.com/jackc/pgx) read-only pool.
- **Frontend:** Vanilla HTML/CSS/JS + [Chart.js](https://www.chartjs.org/),
  embedded via Go's `embed` package. No Node runtime, no build step.
- **Config:** Environment variables only. One required (`DATABASE_URL`).

---

## Compatibility

Tested against listmonk **v6.1.0**. The dashboard probes the connected database
at startup to detect which tables and columns are present and degrades
gracefully on older installs (e.g. if the `bounces` table does not exist,
bounce metrics are hidden rather than crashing).

---

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and redistribute. This tool
is given away freely to the listmonk community and will remain so.
