# specs/S17-deploy-private-instance.md — Deploy (Private Instance)

A deployment section, not a code-build section. Produces one thing: the dashboard
running on Railway against the real listmonk DB (read-only role), behind auth, at
a custom domain. No application code changes. Follow steps in order.

**Status when complete:** dashboard live at listmonk-analytics.wiredhowse.app,
login-gated, reading real data through the read-only role over Railway's private
network.

---

## Pre-req
S00–S16 committed and pushed to github.com/wirehouseworkers/listmonk-analytics.
The repo contains the Dockerfile and railway.json (S15).

---

## Ordered steps

### Step 1 — Create the Railway service from the repo
- Railway → your existing project (the one with listmonk + Postgres) → New →
  Deploy from GitHub repo → select wirehouseworkers/listmonk-analytics.
- Railway detects the Dockerfile (via railway.json) and starts a build.
- Deploying into the SAME project as listmonk's Postgres is intentional — it lets
  the dashboard reach Postgres over the private network (no public proxy needed).

### Step 2 — Set environment variables on the new service
On the dashboard service → Variables, set:
- `DATABASE_URL` = the read-only role over the PRIVATE network host:
  `postgresql://analytics_ro:<readonly_pw>@postgres.railway.internal:5432/railway`
  (private host, not the acela proxy — this service is inside Railway now.)
- `DASHBOARD_USER` = a username you choose.
- `DASHBOARD_PASS` = a strong password you choose.
- (Optional) `ENGAGED_WINDOW_DAYS` if you want something other than 90.
- Do NOT set the public TCP proxy values here; private network is correct for
  service-to-service.

### Step 3 — Confirm the build and health
- Wait for the build to finish and the service to go live.
- Railway's healthcheck hits GET /health (per railway.json) — confirm it passes
  (service shows healthy/active).
- Check the deploy logs: the capability probe should log detected capabilities,
  and the server should report listening.

### Step 4 — Verify behind Railway's generated URL first
- Railway gives the service a temporary public URL. Open it.
- Confirm: you are prompted for auth (DASHBOARD_USER/PASS). Wrong creds → 401.
  Correct creds → the dashboard loads with real data.
- Confirm the Subscribers view is reachable (auth is on, so PII is allowed) and
  renders the engagement table.

### Step 5 — Add the custom domain
- Dashboard service → Settings → Networking → Public Networking → Custom Domain →
  add `listmonk-analytics.wiredhowse.app`.
- Railway shows a CNAME target (e.g. `xxx.up.railway.app`).
- In your DNS (wherever wiredhowse.app is managed): add a CNAME record for
  `listmonk-analytics` pointing to that Railway target.
- Wait for DNS propagation + Railway's automatic TLS cert issuance.

### Step 6 — Final verification at the custom domain
- Open https://listmonk-analytics.wiredhowse.app
- HTTPS valid (cert issued), auth prompt appears, correct creds load the
  dashboard with real data.

---

## Acceptance (all must hold)
1. Service builds and deploys clean on Railway from the repo.
2. Healthcheck passes.
3. DATABASE_URL uses the read-only role over the private network.
4. Auth is enforced — no unauthenticated access to the dashboard.
5. Custom domain resolves over HTTPS and loads real data after login.

---

## Notes
- This is the PRIVATE instance (real data, auth on). A public demo (seeded fake
  data, open) would be a separate deployment with its own throwaway database —
  out of scope here.
- The public TCP proxy on Postgres (acela:56474), enabled earlier for local dev,
  can be DISABLED once this is deployed, since the dashboard now uses the private
  network and local Claude Code work is done. Disabling reduces exposure.
- App code is unchanged by this section. Read-only safety is unchanged: the
  analytics_ro role + default_transaction_read_only still apply.
