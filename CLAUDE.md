# CLAUDE.md

Operating instructions for any Claude Code session working in this repository.
Read this first. It governs **how** you build here. `SCHEMA.md` governs **what**
the data means. `BRIEF.md` governs **what** we are building and why.

## What this project is

A standalone, **read-only** analytics dashboard for [listmonk](https://listmonk.app).
It connects to listmonk's existing Postgres database and surfaces engagement
analytics listmonk's own UI does not. It is a companion tool, distributed for
free to many operators who will rely on it for accurate performance statistics.

## Absolute rules (never violate)

1. **READ-ONLY.** This tool issues `SELECT` only. Never write, update, delete,
   create, alter, or migrate anything in listmonk's database. The connection
   uses a read-only role *and* sets `default_transaction_read_only = on` as
   defense in depth. Any code that could write is a defect.
2. **Do not modify listmonk.** No forks, plugins, schema changes, or migrations.
   listmonk is untouched.
3. **One integration point.** A single `DATABASE_URL` env var. Do not introduce
   additional required configuration without explicit approval.
4. **Correctness over completeness.** A wrong number is worse than a missing one.
   If a metric cannot be computed correctly (e.g. tracking off), hide it or mark
   it unavailable — never guess or approximate silently.

## Correctness rules (from SCHEMA.md — enforce on every query)

1. Rate denominator is always `campaigns.sent`. Guard `sent = 0` (report "—",
   never divide by zero).
2. `subscriber_id` is **nullable** in `campaign_views` and `link_clicks`. Every
   per-subscriber query must handle nulls and be gated behind the
   `IndividualTracking` capability flag.
3. Exclude `type = 'optin'` campaigns from engagement stats unless explicitly
   asked.
4. Complaints are **not** bounces. Keep `bounce_type = 'complaint'` separate
   from `soft`/`hard` everywhere.
5. **Reconcile against listmonk's own UI** for at least 3 real campaigns before
   any metric is marked done. Record the reconciliation in the section's notes.
6. PII (`subscribers.email`, `subscribers.name`) appears only in auth-gated,
   subscriber-level views.

## How sections are built

- **One metric / query / endpoint per section.** Sections are deliberately small
  so a single session can plan, build, test, and verify the work **without the
  context being compacted/compressed.** If you find yourself approaching
  compaction, the section was too big — stop and flag it rather than continuing.
- **Each section ships with a test run** against a live read-only listmonk
  database, and (for metrics) a reconciliation against listmonk's UI.
- **Stop at the section boundary.** Build exactly what the section spec defines.
  Do not start the next section. Do not "while I'm here" adjacent files. Hand
  back, let the operator verify, clear context, set model, begin the next.
- **Follow existing patterns.** Read neighboring code before adding new code.
  Match it. Do not introduce new frameworks, dependencies, or architectural
  patterns without approval.

## Verification before "done"

A section is done only when: it builds/compiles, its test run passes against a
real read-only DB, any metric is reconciled against listmonk's UI (≥3 campaigns),
no write path exists, and output matches the section spec. State each explicitly
when handing back.

## Stack

Go single binary; `pgx` read-only pool; vanilla HTML/CSS/JS + Chart.js frontend
embedded via Go `embed` (no Node, no build step). Deploys on Railway and any
Docker host identically. See `BRIEF.md` for architecture.
