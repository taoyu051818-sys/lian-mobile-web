# Task: GDPlatform commerce frontend boundary

Status: architecture-only baseline
Base: `origin/main@017201731b76fe628cc4c2d4a2dd7a67d3c9d232`
Date: 2026-08-13

## Goal

Record the frontend ownership and network boundary for replacing LAPlatform with GDPlatform before
any commerce runtime or UI is added.

## Scope

- `docs/architecture/gdplatform-commerce-frontend.md`
- this task record
- the matching handoff record

No `src/**`, route, API client, environment, build, dependency, or generated file may change in
this slice.

## Acceptance

- The browser and mini-program call only the LIAN same-origin BFF.
- Commerce orders, campus errands, CNY, points, merchant eligibility and GD operational state remain
  separate concepts.
- Only product-backed commercial group buys reference GDPlatform.
- LA compatibility is default-off and has an owner, exact expiry, per-route telemetry and a
  zero-traffic hard-delete gate.
- Changed Markdown is formatted and `git diff --check` passes.

## Follow-up

The first runtime task must be based on the accepted backend OpenAPI contract and must add strict DTO,
auth-switch, stale-response, malformed-response and direct-origin guard tests.
