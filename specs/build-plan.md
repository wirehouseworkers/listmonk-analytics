# specs/build-plan.md — Section Breakdown

The execution plan. Each section is one Claude Code session: small enough to
build, test, and verify **without context compaction**. Between sections the
operator clears context and sets the recommended model. Sections are ordered so
each builds on verified prior work.

**Legend**
- **Model:** recommended Claude Code model. *Light* = mechanical/boilerplate;
  *Strong* = correctness-critical SQL or design judgment.
- **Budget:** rough context size expectation. All sized to fit one uncompacted
  context with room for the test run. If a session nears compaction, the section
  was mis-sized — stop and flag.
- **Reconcile:** metric sections require listmonk-UI reconciliation before done.

---

### Foundation

**S00 — Scaffold & module**
Create repo skeleton: `go.mod`, directory layout, `main.go` stub that loads
config and exits cleanly. No DB yet. Verify `go build` succeeds.
Model: Light · Budget: small · Reconcile: n/a

**S01 — Config layer**
`internal/config`: env-var loader. Required `DATABASE_URL`; optional
`LISTEN_ADDR`/`PORT`, `DASHBOARD_USER`/`PASS`, `ROOT_URL`, `ENGAGED_WINDOW_DAYS`.
Unit test for parsing + missing-required error.
Model: Light · Budget: small · Reconcile: n/a

**S02 — Read-only DB pool + capability probe**
`internal/db`: pgx pool with `MaxConns` low, `default_transaction_read_only=on`.
Startup probe → `Capabilities{HasBounces, HasLinks, HasCampaignViews,
HasSubscriberLists, IndividualTracking}`. Verify against live read-only DB:
probe reports correct caps; confirm a write attempt is rejected.
Model: Strong · Budget: medium · Reconcile: n/a (but verify read-only enforced)

**S03 — HTTP server, routing, optional basic auth, static embed**
`internal/api` server skeleton: router, health endpoint, optional basic-auth
middleware (active only when user+pass set), Go `embed` of `web/static`. Serves
an empty shell page. Verify it boots, auth toggles correctly, static serves.
Model: Light · Budget: small-medium · Reconcile: n/a

---

### Metrics (one per section; each = query + endpoint + reconciliation)
Each references `specs/metrics-checklist.md` by number. Pattern per section:
write the query in `internal/db`, expose a JSON endpoint in `internal/api`,
test against live read-only DB, reconcile against listmonk UI, hand back.

**S04 — Campaign comparison table** (checklist #6)
The backbone view; many later pieces hang off campaign rows. Aggregates without
row multiplication (lateral/subqueries). Reconcile 3 rows.
Model: Strong · Budget: medium · Reconcile: yes (3 campaigns)

**S05 — Open rate + diagnostics** (checklist #1)
Unique headline; total + ratio in detail tier. Tracking-off labeling.
Reconcile unique ↔ listmonk Reach.
Model: Strong · Budget: medium · Reconcile: yes

**S06 — Click rate + CTOR** (checklist #2)
Unique clicks; CTOR only when tracking on. Reconcile ↔ listmonk Clicks.
Model: Strong · Budget: medium · Reconcile: yes

**S07 — Per-link breakdown** (checklist #3)
Per-URL counts within a campaign. Reconcile ↔ listmonk link stats.
Model: Strong · Budget: medium · Reconcile: yes

**S08 — Engagement curve** (checklist #4)
Time-bucketed opens/clicks since `started_at`. Internal-consistency check
(curve sums to totals) — no listmonk equivalent.
Model: Strong · Budget: medium · Reconcile: consistency check

**S09 — Bounce & complaint trends** (checklist #5)
Gated behind `HasBounces`. Complaints separate from bounces. Reconcile ↔
listmonk Bounces.
Model: Strong · Budget: medium · Reconcile: yes

**S10 — List growth** (checklist #7)
Subscribers over time; per-list active count respecting `lists.optin`.
Reconcile ↔ listmonk Lists counts.
Model: Strong · Budget: medium · Reconcile: yes

**S11 — Subscriber engagement scoring** (checklist #8)
Hard-gated behind `IndividualTracking` AND auth (PII). Recency/frequency over
window. Manual single-subscriber validation.
Model: Strong · Budget: medium · Reconcile: manual spot-check

---

### Frontend (after data endpoints exist & verified)

**S12 — Dashboard shell + overview KPIs**
Embedded HTML/CSS/JS. Layout, navigation, top-line KPI cards wired to S04/S05/
S06 endpoints. Design per frontend aesthetic (no serif fonts; project font
stack). Tracking-off and empty states handled.
Model: Strong (design) · Budget: medium-large · Reconcile: visual vs endpoints

**S13 — Campaign detail view**
Per-campaign drill-down: engagement curve, per-link table, open/click
diagnostics (total + ratio surfaced here), bounces. Wires S07/S08/S09.
Model: Strong · Budget: medium-large · Reconcile: visual vs endpoints

**S14 — Lists & subscribers views**
List-growth charts (S10) and subscriber-engagement table (S11, auth-gated).
Model: Light-Strong · Budget: medium · Reconcile: visual vs endpoints

---

### Ship

**S15 — Dockerfile + railway.json + read-only role SQL**
Multi-stage Docker build (static binary). `railway.json`. `setup/readonly-role.sql`
creating a `SELECT`-only role. Verify clean build from fresh clone deploys.
Model: Light · Budget: small-medium · Reconcile: deploy smoke test

**S16 — README + LICENSE (MIT) + .env.example**
Setup contract, read-only role steps, env vars, screenshots, donation note.
GitHub home: **`wirehouseworkers/listmonk-analytics`** (decided). Module path is
`github.com/wirehouseworkers/listmonk-analytics` (already set in `go.mod`); set
README links and clone URLs accordingly.
Model: Light · Budget: medium · Reconcile: n/a

---

## Cross-section rules (also in CLAUDE.md)
- Stop at each section boundary. Hand back with: builds? test result?
  reconciliation result? read-only confirmed? matches spec?
- Clear context + set model before the next section.
- If a section nears compaction, stop and split it — do not push through.
- Reuse the drafted reference code (`config.go`, `db.go` from planning) only as
  reference; build clean from these specs.

## Suggested grouping for a single sitting (optional)
Foundation S00–S03 are quick and sequential; they can be done back-to-back with
context clears between. Metrics S04–S11 should each be their own session.
Frontend S12–S14 are larger; one session each. Ship S15–S16 quick.
