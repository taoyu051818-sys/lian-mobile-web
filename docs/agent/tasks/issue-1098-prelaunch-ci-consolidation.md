# Task: prelaunch frontend CI consolidation

Status: implementation complete; awaiting review
Issue: `#1098`
Base: `643acae8e7f8c2668196534069414c85506f91b6`
Date: 2026-08-23

## Goal

Keep the accepted frontend quality standard while removing duplicate automation that has no value
before launch. Pull requests retain one authoritative full verification workflow and the existing
deterministic local E2E gate. Production deployment and online canary execution become explicit
manual actions until a release environment exists.

This task changes workflow orchestration only. It must not reduce the assertions executed by
`npm run verify`, alter application behavior, or enable any production feature.

## Required behavior

- Exactly one normal pull-request workflow runs `npm run verify`.
- The existing local Playwright PR gate remains enabled and unchanged in coverage.
- The main-branch deployment workflow remains available, but runs only through an explicit manual
  dispatch and only for `main`.
- The online production journey remains available, but loses its unattended schedule and runs only
  through an explicit manual dispatch.
- Legacy duplicate verification workflow(s) may be removed when their checks are fully covered by
  the authoritative workflow.
- Workflow permissions remain least-privilege and no secret is printed or moved into repository
  configuration.

## Exact file boundary

Allowed workflow files:

- `.github/workflows/frontend-verify.yml`
- `.github/workflows/frontend.yml`
- `.github/workflows/frontend-auto-build.yml`
- `.github/workflows/e2e-journey.yml`

Allowed documentation files:

- `docs/agent/tasks/issue-1098-prelaunch-ci-consolidation.md`
- `docs/agent/handoffs/issue-1098-prelaunch-ci-consolidation.md`
- `docs/CURRENT_STATUS.md`
- `docs/ops/frontend-verification-runtime.md`
- `docs/frontend/release-runbook.md`

Application code, test code, package scripts, dependencies, build configuration, branch-protection
settings and every other file are forbidden unless this task is amended first.

## Acceptance

- workflow YAML parses successfully;
- event/condition inspection proves one PR full-verify path, preserved local E2E, manual-only
  deployment and manual-only online canary;
- `npm run verify` passes unchanged;
- `git diff --check` passes;
- a handoff records the retained coverage and deferred release automation.

## Non-goals

- changing test assertions or reducing contract/security coverage;
- redesigning the build/deploy implementation;
- touching backend or GD workflows;
- creating staging, production credentials, release schedules or operational policy.
