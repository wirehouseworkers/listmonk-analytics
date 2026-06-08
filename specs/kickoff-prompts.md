# specs/kickoff-prompts.md — Claude Code Section Prompts

Copy-paste prompts for starting each build section in Claude Code. One per
section. Open Claude Code in the repo root, set the recommended model (see
`build-plan.md`), paste the matching prompt, then verify the hand-back against
the checklist at the bottom before clearing context for the next section.

---

## S00 — Scaffold & module  (model: light)

```
Read CLAUDE.md first, then specs/build-plan.md and STRUCTURE.md.

Build ONLY section S00 (Scaffold & module):
- Create main.go as a minimal entrypoint that loads config and exits cleanly
  (a stub — no database, no server logic yet).
- Run `go mod tidy` to generate go.sum and resolve the pgx dependency already
  declared in go.mod.
- Confirm `go build ./...` succeeds.

Stop at the section boundary. Do not start S01. Report back: did it build,
which files you created or changed, and confirm you touched nothing outside
S00's scope.
```

---

## S01 — Config layer  (model: light)

```
Read CLAUDE.md first, then specs/build-plan.md.

Build ONLY section S01 (Config layer):
- Implement internal/config/config.go: an env-var loader. Required: DATABASE_URL.
  Optional: LISTEN_ADDR/PORT, DASHBOARD_USER, DASHBOARD_PASS, ROOT_URL,
  ENGAGED_WINDOW_DAYS (default 90).
- Add a unit test covering successful parse and the missing-required-var error.
- Confirm `go test ./internal/config/...` passes and `go build ./...` succeeds.

Stop at the section boundary. Do not start S02. Report back: test result,
build result, files created or changed, and confirm nothing outside S01 scope
was touched.
```

---

## S02 — Read-only DB pool + capability probe  (model: strong)

```
Read CLAUDE.md first, then SCHEMA.md and specs/build-plan.md.

Build ONLY section S02 (Read-only DB pool + capability probe):
- Implement internal/db/db.go: a pgx connection pool with low MaxConns and
  default_transaction_read_only set to on.
- On startup, probe the database for capabilities: HasBounces, HasLinks,
  HasCampaignViews, HasSubscriberLists, and infer IndividualTracking (whether
  campaign_views/link_clicks carry a non-null subscriber_id).
- Fail clearly if the campaigns table is absent (not a listmonk database).

Test against the live read-only database (I will provide a read-only
DATABASE_URL): confirm the probe reports correct capabilities and confirm a
write attempt is rejected by the connection.

Stop at the section boundary. Do not start S03. Report back: probe output,
read-only enforcement confirmed, files created or changed, scope respected.
```

---

## Sections S03–S16

Use the same pattern: name the section, restate its scope from build-plan.md in
your own words, require a test/verify step, and end with "stop at the section
boundary, do not start the next section, report back." Add each section's
prompt here as you reach it, so this file becomes the full kickoff record.

---

## Hand-back verification (run after every section, before clearing context)

A section is accepted only when ALL are true:
1. It built/compiled (`go build ./...` clean) — ask Claude Code to show output.
2. Its test/verify step passed (unit test, or live-DB check, as the section requires).
3. For metric sections: reconciled against listmonk's UI for >=3 campaigns,
   with the comparison recorded.
4. No write path to listmonk's database exists.
5. Output matches the section spec; nothing outside scope was touched.

If all true: clear Claude Code context, set the next section's model, paste the
next prompt. If any are false: do not proceed — fix first.
```
