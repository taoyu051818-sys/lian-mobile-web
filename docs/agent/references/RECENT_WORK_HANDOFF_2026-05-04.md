# Recent Work Handoff - 2026-05-04

Status: current working handoff for the next Codex/Claude thread.

This file summarizes the recent work that is easy to lose in the long thread history. It is intentionally ASCII-only to avoid spreading older mojibake text.

## Current Workspace

- Local workspace: `F:\26.3.13\lian-mobile-web`
- Current full-stack remote: `full` -> `https://github.com/taoyu051818-sys/lian-mobile-web-full.git`
- Older/frontend remote: `origin` -> `https://github.com/taoyu051818-sys/lian-mobile-web.git`
- Preferred push target for full-stack changes: `full/main`

## Product Decisions Confirmed

- AI light publish is now just "Publish".
- Publish is a standalone page, not a modal.
- Publish supports multi-image input.
- After image selection/confirmation, the user should enter Map v2 location picking immediately while upload and AI preview continue in the background.
- AI only creates an editable draft. It must not auto-publish, auto-expand audience, or auto-write post metadata without user confirmation.
- Replies are discussion/reply messages in the Messages page, not private chat.
- Profile contains browsing history, saved posts, and liked posts.
- Save and report live on the detail page, not on feed cards.
- Post detail can link to location. Locations are not a separate saved-object system for now.
- Map v2 uses Gaode tiles plus LIAN overlay layers.
- Raw road network preview is admin/editor only. Student-facing map should only show curated/published spatial assets.
- Map development remains human-assisted only. Claude Code must not independently implement map geometry, road network, editor, renderer, or floor-plan logic.

## Recently Accepted By User

The user manually confirmed:

- Publish V2 main flow passed.
- Like/unlike passed.
- Save/unsave passed.
- Report passed.
- My saved posts passed.
- My liked posts passed.
- Browsing history passed.
- Publish page residual view issue was fixed.
- Reply/discussion messages appear in the intended messages area.
- Detail like UI was accepted as the red filled-heart state.

## Recent Commits Already Documented

See:

- `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-04.md`

Important areas covered there:

- production/development security mode;
- same-origin checks in production;
- production auth rate limiting;
- development setup/status exposure and production hiding;
- security headers for API and static assets;
- secure cookies in production;
- fixed header scroll regression after view transitions;
- detail page and reply layout refinements;
- publish/map/project stabilization batch.

## Current Uncommitted Work: Image Proxy Split

Goal:

- Move image proxy traffic off the main app port.
- Main LIAN app stays on `4100`.
- Image proxy server listens on `4101`.
- Old `4100/api/image-proxy` route must not be retained.

Expected behavior:

- `http://localhost:4100/api/image-proxy?...` returns `404`.
- `http://localhost:4101/api/image-proxy?...` returns proxied image content.
- Frontend image URLs should point to the 4101 image proxy base.

Files changed in the current working tree:

- `server.js`
- `src/server/config.js`
- `src/server/api-router.js`
- `src/server/content-utils.js`
- `src/server/route-matcher.js`
- `public/app-utils.js`
- `public/map-v2.js`
- `public/tools/map-v2-editor.js`
- `scripts/test-routes.js`
- `.env.example`
- `docs/agent/01_PROJECT_FACT_BASELINE.md`
- `docs/agent/contracts/api-contract.md`

Local `.env` was also updated for local testing, but it is ignored and should not be committed:

```env
IMAGE_PROXY_PORT=4101
IMAGE_PROXY_PUBLIC_BASE_URL=http://localhost:4101
```

## Image Proxy Validation Already Run

The following checks were reported as passing in the current working tree:

```bash
node --check server.js
node --check src/server/config.js
node --check src/server/api-router.js
node --check src/server/content-utils.js
node --check public/app-utils.js
node --check public/map-v2.js
node --check public/tools/map-v2-editor.js
node scripts/test-routes.js
node scripts/validate-project-structure.js
node scripts/smoke-frontend.js http://localhost:4100
```

Observed results:

- route tests: `61 passed, 0 failed`
- project structure: `43 passed, 0 failed`
- frontend smoke: `21 passed, 0 failed`
- 4100 image proxy check: `404`
- 4101 image proxy check: `200 image/jpeg`

## Production Deployment Notes For Image Proxy

Production `.env` should include:

```env
IMAGE_PROXY_PORT=4101
IMAGE_PROXY_PUBLIC_BASE_URL=http://<domain-or-ip>:4101
```

If a reverse proxy exposes the image proxy over HTTPS, set:

```env
IMAGE_PROXY_PUBLIC_BASE_URL=https://<public-image-proxy-domain-or-path>
```

If using raw port `4101`, the server firewall/security group must allow inbound traffic to that port.

PM2 can still run one app process because `server.js` starts both listeners.

## Server Update Command Shape

Use the full-stack repo on the server. If `origin` on the server points to the full-stack repository, this shape is OK:

```bash
cd /opt/lian-mobile-web
git fetch origin
git pull origin main
npm install
node --check server.js
node scripts/validate-project-structure.js
node scripts/validate-post-metadata.js
pm2 restart lian-mobile-web --update-env
pm2 logs lian-mobile-web --lines 80
```

If `data/post-metadata.json` conflicts on the server, do not discard it blindly. It may contain live runtime metadata. Back it up first.

## Server Git Auth Note

GitHub password authentication is disabled. Server pulls from a private repo need one of:

- SSH deploy key;
- GitHub PAT over HTTPS;
- a configured credential helper with a valid token.

Do not paste account passwords into Git prompts.

## Current Task Board Interpretation

Do not keep broad completed tasks blocked by old review labels if the user has already manually accepted the behavior.

Current practical state:

- Publish V2: accepted for the main user flow.
- NodeBB detail/profile interactions: accepted for like/save/report/saved/liked/history.
- Messages reply semantics: accepted at product behavior level.
- Map development: human-assisted only.
- Repo split: direction accepted, destructive split still gated.
- Image proxy split: implemented locally and validated, but should be committed/pushed if the user asks to publish it.

## Recommended Next Thread Startup Prompt

Use this in a new thread:

```text
Please read docs/agent/README.md, docs/agent/05_TASK_BOARD.md, docs/agent/PROJECT_FILE_INDEX.md, docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-04.md, docs/agent/references/RECENT_WORK_HANDOFF_2026-05-04.md, then inspect git status. Continue from the image proxy 4101 split and task-board stabilization state.
```

