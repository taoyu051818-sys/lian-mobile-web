# Deploy State Verification - 2026-05-06

This note records the current verifiable deployment signals for frontend review and e2e acceptance.

It intentionally does not document runtime commands, process names, service aliases, ports, SSH targets, or deployment assumptions. If operational intervention is needed, consult the current runtime inventory / runbook first.

## Why this exists

Issue #65 tracks a release/ops blocker from the #63 actor/source and PlaceSheet review round:

- after a main merge, reviewers must be able to confirm which frontend commit/build is being served;
- e2e validation should not accidentally test stale canary/prod assets;
- reviewers should not need to guess runtime commands or deployment details.

## Current source of truth

The current workflow is:

```text
.github/workflows/frontend-auto-build.yml
```

It runs on:

- pull requests targeting `main`;
- pushes to `main`;
- manual `workflow_dispatch`.

The workflow performs:

- `npm ci`;
- `npm run check`;
- `npm run ops:guard`;
- `npm run build`;
- build marker stamping;
- artifact upload;
- main-branch deploy verification when the event is a push to `main`.

## Build marker contract

The build marker file is:

```text
dist/build-commit.txt
```

For CI artifacts, it contains:

```text
commit=<github sha>
ref=<github ref name>
run_id=<github actions run id>
built_at=<utc timestamp>
```

For the main deploy job, it contains:

```text
commit=<deployed git commit>
branch=main
built_at=<utc timestamp>
builder=github-actions
```

This marker is the review-facing contract for verifying whether a served frontend build matches the expected main commit.

## Review verification path

Before running #63 / #67 e2e acceptance:

1. Open the GitHub Actions run for the target `main` commit.
2. Confirm the `frontend auto build` workflow completed successfully.
3. Confirm the uploaded artifact name includes the expected commit SHA:

   ```text
   frontend-dist-<github sha>
   ```

4. Confirm the workflow logs include the remote build marker verification step for main pushes.
5. If the deployed frontend serves static files from `dist`, check the served marker path for the current host:

   ```text
   /build-commit.txt
   ```

6. Compare `commit=` from the served marker with the expected merged commit SHA.

If the served marker is missing or does not match the expected commit, do not treat manual e2e results as authoritative until release/ops confirms the deployment state.

## Acceptance gate for product review

Use this gate before manual QA:

- [ ] GitHub Actions `frontend auto build` succeeded for the expected main commit.
- [ ] The build artifact exists for the expected commit.
- [ ] Main deploy marker verification ran for a main push.
- [ ] Served `/build-commit.txt` exists where static `dist` is served.
- [ ] Served marker `commit=` equals the expected main commit.
- [ ] If any check fails, record the mismatch in #65 and pause #63 / #67 e2e acceptance.

## Non-goals

This note does not define:

- runtime process names;
- service managers;
- SSH hostnames;
- ports;
- manual deploy commands;
- canary/prod topology.

Those belong in the current runtime inventory / runbook, not in product contract or QA review notes.
