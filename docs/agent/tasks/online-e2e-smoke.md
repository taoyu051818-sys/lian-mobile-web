# Online E2E Smoke Test

## Purpose

This task adds a manually triggered online smoke test for the deployed LIAN mobile web service.

It is designed to verify staging connectivity without committing secrets to the repository.

## Files

- `scripts/e2e-online-smoke.mjs`
- `.github/workflows/online-e2e.yml`

## Required GitHub Secrets

Configure these in GitHub repository settings or the `staging` environment:

- `STAGING_APP_BASE_URL` — required. Example: `https://staging.example.com`

Optional:

- `STAGING_ADMIN_TOKEN` — enables admin read checks.
- `STAGING_TEST_LOGIN` — enables login checks when paired with password.
- `STAGING_TEST_PASSWORD` — enables login checks when paired with login.

Do not commit `.env`, API keys, admin tokens, Cloudinary URLs, SMTP passwords, NodeBB tokens, or AI provider keys.

## Workflow inputs

The workflow is manual only: `workflow_dispatch`.

Inputs:

- `allow_mutations`: default `false`. When `true`, the script may run low-risk mutation checks such as `/api/admin/reload` and logout.
- `test_ai_preview`: default `false`. When `true`, the script calls `/api/ai/post-preview`.

## Current coverage

Always checked:

- `GET /api/setup/status`
- `GET /api/auth/rules`
- `GET /api/feed?tab=此刻&page=1&limit=4`
- `GET /api/map/v2/items`

Checked when optional secrets are configured:

- `GET /api/admin/feed-rules`
- `POST /api/admin/reload` only when mutations are explicitly enabled.
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout` only when mutations are explicitly enabled.
- `POST /api/ai/post-preview` only when `test_ai_preview=true`.

## How to run

1. Open GitHub repository settings.
2. Add secrets to the `staging` environment or repository Actions secrets.
3. Open Actions.
4. Select `online-e2e`.
5. Click `Run workflow`.
6. Keep `allow_mutations=false` for the first run.
7. Enable optional inputs only after staging data and credentials are safe for testing.

## Known limitations

- This is a smoke test, not a full browser E2E suite.
- It does not create posts or upload images by default.
- It intentionally avoids destructive cleanup steps.
- It assumes the staging service is already deployed and reachable.

## Follow-up

Recommended next tests:

- Setup endpoint lock check after setup is complete.
- Admin token non-exposure check for `/tools/map-v2-editor.html`.
- Upload size and MIME validation.
- Audience visibility matrix for public, campus, school, private, and linkOnly.
- Stored XSS payload regression for detail and replies.
