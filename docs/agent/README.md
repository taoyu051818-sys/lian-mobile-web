# Agent Docs Index

This directory is the working memory for Codex threads. Treat merged GitHub PRs and current code as more authoritative than any doc here.

Current execution status: [`../CURRENT_STATUS.md`](../CURRENT_STATUS.md). As last verified on 2026-08-02, there is no active execution queue. Do not infer active work from task, handoff, or archived status files.

## Source-Of-Truth Order

When docs disagree, prefer this order:

1. Current code on `main`.
2. Merged GitHub PRs, especially newest PRs.
3. `docs/CURRENT_STATUS.md` - verified queue and release status.
4. `docs/agent/00_AGENT_RULES.md` - operating rules, validation, high-conflict files.
5. `references/` docs as context, after checking against current code.
6. `tasks/` and `handoffs/` as task scope/history only.
7. `domains/SYSTEM_OVERVIEW.md` as business/domain intent.

## Thread Workflow

Default division of labor:

- Codex / code thread: project management, planning, architecture decisions, review, acceptance, and docs status.
- Claude Code thread: implementation inside the approved task boundary.

## Start Here

Read these in order before starting implementation work:

1. `../CURRENT_STATUS.md` - current queue truth.
2. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files.
3. Current code on `main` and `package.json`.
4. Recent merged GitHub PRs for the task area.
5. Relevant `references/` docs for context.
6. Relevant `tasks/` or `handoffs/` for historical scope only.

## Current Frontend Runtime Snapshot

- Vue/Vite is the sole active web runtime.
- The legacy static runtime was removed in PR #282.
- `npm run dev` starts the Vite dev server.
- `npm run preview` starts the Vite preview server (production build).
- `npm run verify` runs check, ops guard, build, and smoke.

## Directory Structure

- `domains/` — system overview and business domain context.
- `handoffs/` — completed-thread summaries and next-thread instructions.
- `references/` — reference docs, briefs, and status notes.
- `tasks/` — task scope/history for active work.
- `templates/` — handoff and task document templates.
