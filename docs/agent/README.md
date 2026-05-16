# Agent Docs Index

This directory is the working memory for Codex threads. Treat merged GitHub PRs and current code as more authoritative than any doc here.

## Source-Of-Truth Order

When docs disagree, prefer this order:

1. Current code on `main`.
2. Merged GitHub PRs, especially newest PRs.
3. `docs/agent/00_AGENT_RULES.md` - operating rules, validation, high-conflict files.
4. `references/` docs as context, after checking against current code.
5. `tasks/` and `handoffs/` as task scope/history only.
6. `domains/SYSTEM_OVERVIEW.md` as business/domain intent.

## Thread Workflow

Default division of labor:

- Codex / code thread: project management, planning, architecture decisions, review, acceptance, and docs status.
- Claude Code thread: implementation inside the approved task boundary.

## Start Here

Read these in order before starting implementation work:

1. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files.
2. Current code on `main` and `package.json`.
3. Recent merged GitHub PRs for the task area.
4. Relevant `references/` docs for context.
5. Relevant `tasks/` or `handoffs/` for task scope.

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
