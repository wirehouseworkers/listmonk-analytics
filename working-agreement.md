# Working Agreement (Planning Process)

This document describes **how the planning and specification work for this
project is conducted** in conversation, before and between Claude Code build
sessions. It is committed to the repository for transparency.

> **Audience note:** This is *not* an instruction file for Claude Code build
> sessions. Build sessions read `CLAUDE.md`. This document is about the planning
> collaboration and is kept separate on purpose so that execution instructions
> and process notes never bleed into each other.

## Why this exists

This is a free tool many operators will rely on for accurate performance
statistics. The dominant risk is not speed — it is shipping a wrong number, or
a tool that breaks across listmonk versions. The planning process is structured
to protect correctness and to keep each build session small enough to verify.

## Roles

- **Planning (in chat):** produce curated, self-contained specifications,
  schema references, and acceptance criteria. Surface correctness risks early.
- **Execution (Claude Code):** build one section per session against its spec,
  test against a live read-only database, reconcile metrics against listmonk's
  UI, and stop at the section boundary.
- **Operator (the human):** approve each artifact and each section, run/verify
  output, and between sections clear context and set the model.

## Process rules

1. **Gates are real.** Work proceeds one unit at a time. Each artifact (brief,
   schema, checklist, spec) and each build section is reviewed and approved
   before the next begins. Do not produce past a checkpoint.
2. **One unit per turn during planning.** Avoid batching multiple specs or
   running ahead into implementation while a prior unit is unapproved.
3. **Sections sized to avoid compaction.** Build sections are scoped so a single
   Claude Code context can complete and verify them without compression. When in
   doubt, smaller.
4. **Lean shared references.** Specs reference `SCHEMA.md`, `BRIEF.md`,
   `CLAUDE.md`, and the metrics checklist rather than restating them, keeping
   each build session's context small.
5. **Model per section.** Each section spec recommends a model (lighter for
   mechanical work, stronger for correctness-critical query logic).
6. **Surface risk over smoothing.** Correctness ambiguities (e.g. open-rate
   numerator, opt-in status definitions) are raised and decided before code
   depends on them, not papered over.
7. **Planning is not the project.** Documentation is bounded. Once the rules and
   foundation exist, the work moves to building. Refining process further is not
   a substitute for progress.

## Artifact order

1. `SCHEMA.md` — curated schema reference. *(done)*
2. `CLAUDE.md` — execution rules for build sessions. *(done)*
3. `docs/working-agreement.md` — this document. *(done)*
4. `BRIEF.md` — scope, features, architecture, non-goals. *(drafted; sign-off pending)*
5. `specs/metrics-checklist.md` — per-metric definitions + reconciliation steps.
6. `specs/build-plan.md` — section breakdown, model + token budget per section.
7. `specs/NN-*.md` — one buildable section spec at a time.

After (4)–(6), planning is considered closed and execution begins.
