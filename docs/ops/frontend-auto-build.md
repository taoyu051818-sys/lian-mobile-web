# Frontend auto build and deploy

This repository treats frontend deployment as a repeatable build pipeline instead of a manual follow-up step.

## Workflow

The workflow is defined in `.github/workflows/frontend-auto-build.yml`.

### Pull requests

Every pull request to `main` should run:

```bash
npm ci
npm run check
npm run ops:guard
npm run build
```

The generated `dist` directory is uploaded as a GitHub Actions artifact and stamped with `dist/build-commit.txt`.

### Push to main

After a merge to `main`, GitHub Actions connects to the frontend server over SSH and runs the same source-of-truth build from the repository checkout:

```bash
cd "$LIAN_WEB_DIR"
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
```

Then it writes a build marker:

```bash
cat dist/build-commit.txt
```

The marker records the deployed commit, branch, build time, and builder.

## Required GitHub configuration

Add these repository or environment secrets:

| Name | Purpose |
| --- | --- |
| `LIAN_WEB_SSH_HOST` | SSH host for the frontend server |
| `LIAN_WEB_SSH_USER` | SSH user that owns or can write the frontend checkout |
| `LIAN_WEB_SSH_KEY` | Private key used by GitHub Actions to connect to the server |

Optional variable:

| Name | Default | Purpose |
| --- | --- | --- |
| `LIAN_WEB_DIR` | `/opt/lian-mobile-web` | Frontend repository path on the server |

The workflow uses the `frontend-production` environment for the deploy job. That environment can require reviewers later if production deploys need manual approval.

## Server expectations

The server path in `LIAN_WEB_DIR` must already be a git checkout of `taoyu051818-sys/lian-mobile-web` and must have Node/npm available.

Minimum server-side verification:

```bash
cd /opt/lian-mobile-web
git remote -v
git branch --show-current
node -v
npm -v
```

The SSH user must be able to run:

```bash
cd /opt/lian-mobile-web
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
```

No process manager or web server reload command is assumed by this workflow. It only updates the repository checkout and the Vite `dist` build output.

## How to verify a deployment

On the server:

```bash
cd /opt/lian-mobile-web
cat dist/build-commit.txt
git rev-parse HEAD
```

The `commit=` value in `dist/build-commit.txt` should match `git rev-parse HEAD` and the latest merged commit on `main`.

If the browser still shows an older UI after the workflow succeeds, check the served asset rather than the source checkout:

```bash
curl -fsSL http://127.0.0.1/ | grep -Eo '/assets/[^"'"']+\.(js|css)' | sort -u
```

Then compare the served asset with the current `dist` directory. If source and dist are current but the browser still shows stale behavior, clear browser cache or inspect CDN/cache settings.

## Why this exists

The project repeatedly hit a mismatch where `main` had the correct code but the visible frontend was stale. This workflow makes the expected development logic explicit:

1. PR verifies.
2. `main` builds.
3. Server checkout is reset to `origin/main`.
4. Vite `dist` is regenerated.
5. The deployed commit is written to a visible marker.
