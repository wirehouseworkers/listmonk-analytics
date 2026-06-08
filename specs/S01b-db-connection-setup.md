# specs/S01b-db-connection-setup.md — Read-Only DB Connection (Prerequisite for S02)

A setup section, not a code-build section. It produces one thing: a working,
read-only `DATABASE_URL` that S02 (and all later DB sections) test against.
No code is written here. Follow the steps in order. Do not skip ahead.

**Status when complete:** a gitignored `.env` file at the repo root contains a
read-only `DATABASE_URL`, verified to connect and verified to be unable to write.

---

## Why this exists
S02 onward connect to listmonk's Postgres. They must connect as a **read-only
role**, never with listmonk's own credentials, so the tool is physically
incapable of modifying data. This section creates and verifies that connection
before any DB-touching code runs.

---

## Ordered steps

### Step 1 — Read-only role (DONE)
The `analytics_ro` role was created via `setup/readonly-role.sql` in Railway's
query tab and verified:
- `analytics_ro` exists and can log in.
- On `campaigns`: SELECT = true; INSERT/UPDATE/DELETE = false.
✅ Complete. No action needed.

### Step 2 — Get Railway's PUBLIC Postgres connection string
Claude Code runs on the local machine and connects *out* to Railway, so the
internal host (`postgres.railway.internal`) will not work. The public one is
required.
- Railway → Postgres service → **Connect** tab → copy the **public** connection
  string. It looks like:
  `postgresql://postgres:<pw>@<host>.proxy.rlwy.net:<port>/railway`
- Do not use this string directly — it is the admin user. It is only the source
  of the host, port, and database name.

### Step 3 — Build the read-only connection string
From the public string, change two values:
- username `postgres` → `analytics_ro`
- password → the read-only password set in `setup/readonly-role.sql` (Step 1)
Keep the host, port, and `/railway` database name unchanged. Result:
```
postgresql://analytics_ro:<readonly_pw>@<host>.proxy.rlwy.net:<port>/railway
```

### Step 4 — Put it in a gitignored .env file
- Create a file named `.env` at the repo root.
- Single line:
  ```
  DATABASE_URL=postgresql://analytics_ro:<readonly_pw>@<host>.proxy.rlwy.net:<port>/railway
  ```
- Save. Never commit this file. Never paste this string into chat.

### Step 5 — Verify .env is ignored by git
- Run `git status`.
- `.env` must **not** appear in the output.
- If it does appear: stop. The ignore rule failed; fix before continuing.

### Step 6 — Verify the connection works and is read-only
This is the gate before S02. Done via Claude Code with a throwaway check
(Claude Code reads `.env`, attempts a SELECT, then attempts a write that must
fail). The exact Claude Code instruction for this is issued when we reach this
step — not before.

Expected result:
- A simple SELECT (e.g. `SELECT count(*) FROM campaigns`) succeeds.
- A write attempt (e.g. `CREATE TEMP TABLE` or `INSERT`) is rejected by the
  read-only role / read-only transaction.

---

## Acceptance (all must be true before S02 begins)
1. `.env` exists at repo root with a read-only `DATABASE_URL`.
2. `git status` does not list `.env`.
3. SELECT against the DB succeeds through that string.
4. A write attempt through that string is rejected.

When all four hold, S01b is complete and S02 may begin.
```
