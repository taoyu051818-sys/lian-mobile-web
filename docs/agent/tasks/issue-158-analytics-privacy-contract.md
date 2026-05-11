# Issue #158 Task Note

Task: `analytics-privacy-contract-doc-slice`

## Task boundary

Repo: `taoyu051818-sys/lian-mobile-web`
Issue: `#158`
Branch: `codex/issue-158-analytics-privacy-contract`

Allowed files from the task proposal:
- `docs/frontend/analytics-privacy-contract.md`
- `docs/agent/handoffs/analytics-privacy-contract.md`
- `docs/agent/tasks/issue-158-analytics-privacy-contract.md`

Forbidden files from the task proposal:
- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Delivered scope

This slice adds a docs-only analytics contract that defines:
- event taxonomy and naming rules
- allowlist/forbidden-field privacy boundaries
- consent and reduced-tracking expectations
- analytics identity separation from auth, alias, `clientId`, and `readerId`
- impression, batching, offline, and retry guardrails
- a future frontend wrapper boundary for `trackEvent()` work

## Non-goals

- no analytics SDK integration
- no runtime telemetry transport
- no consent UI
- no backend ingest implementation
- no claim that issue `#158` is fully complete

## Validation plan

Requested by proposal:
- `npm run check`
- manual link/reference sanity for changed docs

Actual validation in this execution lane:
- manual sanity review against issue `#158`, current root `README.md`, and `docs/agent/README.md`
- `npm run check` not run because this docs-only slice was executed through GitHub file edits without a runnable local checkout in the container

## Linkage wording

Related to #158.
Part of #158.
Does not close #158.
