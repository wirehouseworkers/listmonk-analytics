-- setup/readonly-role.sql
--
-- Creates a read-only PostgreSQL role for listmonk-analytics.
-- This role can SELECT from listmonk's tables and NOTHING else — no INSERT,
-- UPDATE, DELETE, or DDL. The dashboard connects with this role so it is
-- physically incapable of modifying listmonk data.
--
-- HOW TO RUN (Railway):
--   1. Open your Railway project → Postgres service → "Data" / "Query" tab
--      (or connect with psql using the service's connection string).
--   2. Paste and run this whole file.
--   3. IMPORTANT: replace 'CHANGE_ME_STRONG_PASSWORD' below with a real strong
--      password before running.
--   4. Build the dashboard's DATABASE_URL using this role (see bottom of file).
--
-- Re-running is safe: it uses IF NOT EXISTS / idempotent grants where possible.

-- 1. Create the role (login user). CHANGE THE PASSWORD.
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'analytics_ro') THEN
      CREATE ROLE analytics_ro LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
   END IF;
END
$$;

-- 2. Allow the role to connect to the database and use the public schema.
--    (Railway's default database is named "railway".)
GRANT CONNECT ON DATABASE railway TO analytics_ro;
GRANT USAGE ON SCHEMA public TO analytics_ro;

-- 3. Grant SELECT on all current tables in public schema.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro;

-- 4. Grant SELECT on any tables created in the future (e.g. after a listmonk
--    upgrade adds tables), so the role keeps working without re-running grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_ro;

-- 5. Explicitly ensure NO write privileges. (SELECT-only by construction above,
--    but this makes intent unmistakable and revokes anything inherited.)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
   ON ALL TABLES IN SCHEMA public FROM analytics_ro;

-- 6. (Optional, defense in depth) Make the role itself read-only at the session
--    level so even a SELECT that tries to write (e.g. SELECT ... FOR UPDATE on a
--    function with side effects) is blocked.
ALTER ROLE analytics_ro SET default_transaction_read_only = on;

-- ----------------------------------------------------------------------------
-- BUILDING THE CONNECTION STRING (DATABASE_URL) FOR THE DASHBOARD
--
-- Take your existing listmonk Postgres connection string and swap in this
-- role's username and password. For Railway internal networking it looks like:
--
--   postgresql://analytics_ro:CHANGE_ME_STRONG_PASSWORD@postgres.railway.internal:5432/railway
--
-- For an external connection (testing from your machine), use Railway's public
-- Postgres host/port instead of the .internal host. Get that from the Postgres
-- service → "Connect" → public connection string, and replace the username,
-- password, and leave the database name (railway) intact.
--
-- NEVER commit a real DATABASE_URL. Set it as an environment variable only.
-- ----------------------------------------------------------------------------
