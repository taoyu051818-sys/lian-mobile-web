# Frontend runtime responsibility contract

This document separates install, build, deploy-prepare, and startup responsibilities for the LIAN Mobile Web frontend runtime path.

Related to #171.
Part of #171.
Does not close #171.

## Scope

This contract covers the Vue/Vite frontend runtime. The legacy static runtime was removed in PR #282 and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy.

It documents responsibility boundaries only. It does not redesign the hosting strategy, replace `vite preview`, or add build-manifest automation.

## Responsibility split

| Stage | Purpose | Allowed actions | Forbidden actions | Current entrypoints |
|---|---|---|---|---|
| Install | Materialize the committed dependency graph from `package-lock.json` | `npm ci` in CI or deploy-prepare; `npm install` only for intentional local dependency changes that also update the lockfile | Running package installation during startup or after the runtime process has been handed off to the process manager | `npm ci` |
| Build | Produce the frontend artifact that is reviewed and deployed | `npm run build`; type-check and static verification as part of CI or deploy-prepare | Building on the target host as part of production startup | `npm run build`, `npm run verify` |
| Deploy-prepare | Assemble the artifact, runtime config, and process-manager inputs for the target environment | Copying the reviewed artifact, wiring runtime config, checking ports, confirming rollback inputs | Ad-hoc rebuilds, dependency graph changes, or undocumented host-specific mutations after review | CI artifact assembly, operator/environment setup |
| Startup | Launch the already-prepared frontend runtime | Start the Vue/Vite preview process with the reviewed artifact and prepared dependencies; fail fast if prerequisites are missing | `npm install`, `npm ci`, `npm run build`, lockfile mutation, or hidden environment repair during process launch | `npm run preview`, process-manager start/restart |

## Current implementation truth

The current merged implementation already covers two important pieces of this contract:

- PR #170 removed runtime-time dependency installation from the startup path and made missing prerequisites fail fast.
- PR #189 aligned CI and local policy around lockfile-based install and a Node version contract.

This document exists so those merged behaviors remain easy to find and do not get reintroduced through future startup or deploy changes.

## Operator expectations

Before startup:

- Dependencies are already present from a lockfile-based install flow.
- The reviewed frontend build artifact already exists.
- Runtime config has already been chosen for the target environment.
- Port ownership and reverse-proxy expectations have already been checked outside the startup script.

During startup:

- The supervisor may validate that required runtime prerequisites exist.
- Missing prerequisites must stop startup with a clear operator-facing error.
- Startup must not try to repair the environment by installing dependencies or rebuilding artifacts.

After startup:

- Verification and smoke results should describe the artifact that was actually launched.
- Any failure that requires reinstalling dependencies or rebuilding artifacts belongs to deploy-prepare, not to a running production host.

## What this contract intentionally does not decide yet

The following work remains separate and should be handled by later bounded slices:

- whether production canary should continue using `vite preview` or move to a different static-hosting path;
- release-manifest generation and artifact provenance automation;
- a broader supervisor split beyond the current startup/preflight boundary;
- deployment-owner or release-governance decisions.

## Related docs

- `README.md` for the current developer-facing commands
- `docs/frontend/release-runbook.md` for release, smoke, and rollback steps
- `docs/ops/runtime-inventory.md` for runtime-sensitive file and workflow guardrails
