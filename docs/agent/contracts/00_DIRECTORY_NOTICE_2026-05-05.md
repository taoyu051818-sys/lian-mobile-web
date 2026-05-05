# Contracts Directory Notice - 2026-05-05

This directory contains split-era API contract/inventory documents. Treat files in this folder as historical contract context unless current code, merged PRs, and override files confirm the contract is still accurate.

## Current rule

Before using any file in `docs/agent/contracts/`, read these first:

1. `docs/agent/README.md`
2. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
3. `docs/agent/references/CONTRACTS_OVERRIDE_2026-05-05.md`
4. Current frontend callers
5. Current backend routes/route registry in `lian-platform-server`

## Safe usage

Use contracts to understand split-era endpoint inventory, old request/response shapes, and broad frontend/backend boundary intent.

Do not use contracts alone to decide whether an endpoint currently exists, whether it is deprecated, what port owns it, what route module owns it, or whether a response shape has drifted.
