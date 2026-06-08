# specs/metrics-checklist.md — Phase 1 Metric Definitions

The authoritative definition of every Phase 1 metric. Claude Code references
this for every query. **No metric is "done" until reconciled against listmonk's
own UI for ≥3 real campaigns** (see `CLAUDE.md`). Schema columns: see `SCHEMA.md`.

Conventions used below:
- **Denominator** for all rates is `campaigns.sent`. If `sent = 0`, output `—`
  (null), never 0% and never a division.
- "Tracking on" = `IndividualTracking` capability is true (subscriber_id present).
- Engagement metrics consider only `campaigns.type = 'regular'` by default.

---

## 1. Open rate (headline) + open diagnostics
**Definition.** Unique opens ÷ sent, as the headline statistic.
**Numerator (headline):** `COUNT(DISTINCT subscriber_id)` from `campaign_views`
for the campaign. Matches listmonk's "Reach."
**Computed in same pass (not headline):**
- Total opens = `COUNT(*)` (cheap, same scan).
- Total/unique ratio = total ÷ unique (re-open / anomaly signal).

**Presentation tiering.** Headline view shows **unique open rate** only. Total
opens and the ratio appear **only** in the campaign detail / drill-down, as a
diagnostic for funnel anomalies. Do not surface total on the main dashboard.

**Edge cases.**
- Tracking off → `subscriber_id` all null → unique is meaningless. Show total
  opens labeled "opens (unique unavailable — individual tracking off)".
- `sent = 0` → rate `—`.
- Exclude `optin` campaigns.

**Reconcile against:** listmonk campaign view → "Views"/"Reach". Match unique to
Reach for 3 campaigns.

---

## 2. Click rate (headline) + click diagnostics
**Definition.** Unique clicks ÷ sent (headline).
**Numerator (headline):** `COUNT(DISTINCT subscriber_id)` from `link_clicks` for
the campaign.
**Same pass:** total clicks = `COUNT(*)`.
**CTOR (click-to-open rate):** unique clicks ÷ unique opens — **only when
tracking on**; otherwise omit (not "0").

**Edge cases.** Tracking off → unique clicks meaningless; show total clicks
labeled. `sent = 0` → `—`. Exclude `optin`.

**Reconcile against:** listmonk campaign → "Clicks".

---

## 3. Per-link click breakdown
**Definition.** Within one campaign, click counts per destination URL.
**Query.** `link_clicks` JOIN `links` ON `link_clicks.link_id = links.id`,
filter `link_clicks.campaign_id = $1`, group by `links.url`, order by count desc.
Provide both total clicks (`COUNT(*)`) and unique (`COUNT(DISTINCT subscriber_id)`)
per link.

**Edge cases.** Links with zero clicks won't appear (no rows) — acceptable for a
"what got clicked" view; note it. `campaign_id` is nullable in `link_clicks`;
always filter by the specific campaign.

**Reconcile against:** listmonk campaign → link click stats.

---

## 4. Engagement curve (opens & clicks over time since send)
**Definition.** Time series of opens and clicks bucketed by interval since the
campaign's `started_at`.
**Query.** From `campaign_views` and `link_clicks` for the campaign, bucket
`created_at` (e.g. hourly for first 48h, then daily). X-axis = time since
`started_at`.
**Edge cases.** `started_at` null (never sent / draft) → no curve. Use
`started_at` as the zero anchor, not `created_at` of the campaign row.

**Reconcile against:** listmonk has no equivalent; sanity-check totals on the
curve sum to the campaign's total opens/clicks.

---

## 5. Bounce & complaint trends
**Definition.** Counts of `soft`, `hard`, and `complaint` over time, and per
campaign. **Complaints reported separately from bounces — never merged.**
**Query.** `bounces` grouped by `type` and by `created_at` bucket; optionally by
`campaign_id`. Bounce rate per campaign = bounces ÷ `sent` (soft+hard);
complaint rate = complaints ÷ `sent`, shown as its own figure.
**Capability.** Gate behind `HasBounces` (probe). If absent, hide the panel.
**Edge cases.** `campaign_id` nullable in `bounces` (bounce not tied to a
campaign) — include in global trend, exclude from per-campaign rate.

**Reconcile against:** listmonk campaign → "Bounces" count.

---

## 6. Campaign comparison table
**Definition.** One row per campaign: name, sent, unique open rate, unique click
rate, bounce rate, complaint rate, sent date. Sortable.
**Query.** `campaigns` LEFT JOIN aggregates from views/clicks/bounces. Use
subqueries or lateral joins; avoid row multiplication from naive joins
(a campaign with many views × many clicks must not multiply).
**Edge cases.** `sent = 0` → rates `—`. Exclude `optin` by default with a toggle
to include. Status filter (finished/running/etc.).

**Reconcile against:** spot-check 3 rows against listmonk's per-campaign numbers.

---

## 7. List growth over time
**Definition.** New subscribers per interval, optionally per list.
**Query.** `subscribers.created_at` bucketed (daily/weekly). Per-list: join
`subscriber_lists`. **Active-on-list count** must respect opt-in type: check
`lists.optin`; for `double` opt-in active = `subscriber_lists.status='confirmed'`,
for `single` opt-in treat `unconfirmed` as active. Do not assume one rule.
**Edge cases.** `subscriber_lists.list_id` nullable; orphaned subscribers.
Blocklisted subscribers excluded from "active".

**Reconcile against:** listmonk Lists view subscriber counts per list.

---

## 8. Subscriber engagement scoring (tracking-gated)
**Definition.** Per subscriber: recency (last open/click) and frequency (count
over the engagement window, default 90d). Simple score, not ML.
**Capability.** **Hard-gated behind `IndividualTracking`.** If tracking off, the
entire panel is hidden — there is no subscriber_id to score by.
**PII.** Exposes email/name → only in auth-gated views (`DASHBOARD_USER/PASS`).
**Query.** Aggregate `campaign_views` + `link_clicks` by `subscriber_id` within
window; recency = max(created_at), frequency = counts.
**Edge cases.** Null subscriber_id rows excluded. Deleted subscribers
(subscriber_id set null on delete) excluded.

**Reconcile against:** no listmonk equivalent; validate a single known
subscriber's open/click history by hand.

---

## Global reconciliation protocol (per metric, before "done")
1. Pick 3 finished `regular` campaigns with real sends.
2. Open each in listmonk's admin UI; record its shown views/reach, clicks,
   bounces.
3. Run the dashboard's query for the same campaigns.
4. Numbers must match (unique↔Reach, clicks↔Clicks, bounces↔Bounces). Record
   the comparison in the section's hand-back notes.
5. Any mismatch is a blocker — diagnose before marking done.
