# File Ownership and Conflict Levels

## Conflict level definitions

- **hard-lock**: only the designated owner should modify. Other contributors must get owner review before merge.
- **soft-lock**: can be modified by anyone, but must check the current task doc and understand the context first.
- **open**: low conflict risk. New files in these directories are generally safe.

## src/server/ — Backend services

| File | Level | Owner | Notes |
|---|---|---|---|
| `api-router.js` | soft-lock | shared | Route mounting only. Do not add business logic here. New routes: add 1-2 lines. |
| `feed-service.js` | hard-review | Programmer A | Recommendation core: scoring, filtering, diversity, curated pages, moment feed, debug. Touching this requires understanding the full pipeline. |
| `post-service.js` | hard-review | Programmer A | Publishing core: HTML building, NodeBB topic creation, reply handling. |
| `auth-service.js` | soft-lock | Programmer A | User model, password, session, NodeBB uid mapping. |
| `auth-routes.js` | soft-lock | Programmer A | Register/login/logout endpoints. Depends on auth-service. |
| `ai-post-preview.js` | open | — | AI draft generation. Self-contained, low conflict. |
| `ai-light-publish.js` | open | — | AI draft save + publish. Depends on post-service. |
| `channel-service.js` | open | — | Campus channel messages. Independent module. |
| `admin-routes.js` | open | — | Admin endpoints. Depends on data-store. |
| `nodebb-client.js` | soft-lock | Programmer A | NodeBB HTTP client. All NodeBB calls go through here. |
| `content-utils.js` | soft-lock | shared | HTML processing, image URL helpers. Used by many services. |
| `image-proxy.js` | open | — | Cloudinary proxy. Self-contained. |
| `upload.js` | open | — | Image upload to Cloudinary. Self-contained. |
| `data-store.js` | soft-lock | shared | JSON file read/write. Changes here affect all data operations. |
| `config.js` | soft-lock | shared | Environment loading. Rarely needs changes. |
| `cache.js` | open | — | In-memory cache maps. |
| `paths.js` | open | — | File path constants. |
| `http-response.js` | open | — | Response helpers. |
| `request-utils.js` | open | — | Body parsing, admin auth. |
| `static-data.js` | open | — | Institutions list, map points. |
| `static-server.js` | open | — | Static file serving. |
| `setup-page.js` | open | — | First-run setup page. |

New files under `src/server/` are open for creation. Use the naming pattern `<module>-service.js` or `<module>-routes.js`.

## public/ — Frontend

| File | Level | Owner | Notes |
|---|---|---|---|
| `app.js` | soft-lock | Programmer B | Event delegation, global listeners, pull refresh, app initialization. Keep thin. |
| `app-state.js` | soft-lock | Programmer B | Global state, state aliases, legacy static map data. Load before all app feature scripts. |
| `app-utils.js` | soft-lock | Programmer B | DOM helpers, API helper, upload/compression helpers, publish progress. Shared by most frontend files. |
| `app-auth-avatar.js` | soft-lock | Programmer B | Auth UI helpers, current user loading, avatar crop flow. |
| `app-feed.js` | soft-lock | Programmer B | Feed tabs, masonry cards, detail view, image gallery/lightbox. |
| `app-legacy-map.js` | soft-lock | Programmer B | Old illustrated map compatibility, route animation, old coordinate conversion. |
| `app-ai-publish.js` | soft-lock | Programmer B | AI light publish sheet, AI preview/draft/publish, location draft handling, Map v2 location pick bridge. |
| `app-messages-profile.js` | soft-lock | Programmer B | Channel messages, replies, auth submit, profile panel, regular post submit. |
| `styles.css` | soft-lock | Programmer B | All styles. |
| `index.html` | soft-lock | Programmer B | HTML structure. Rarely changes. |
| `assets/` | open | — | Images, icons. |

New files under `public/` are allowed when they keep one clear feature boundary. Do not add new frontend logic back into `app.js` unless it is event binding or initialization.

Classic script load order is currently part of the architecture:

1. `map-v2.js`
2. `app-state.js`
3. `app-utils.js`
4. feature scripts
5. `app.js`

## data/ — Runtime data

| File | Level | Owner | Notes |
|---|---|---|---|
| `post-metadata.json` | soft-lock | shared | 2314 lines. Only modify entries for your task's tids. Never bulk-format. Backup before large changes. |
| `feed-rules.json` | soft-lock | shared | Feed config. Changes affect all users immediately. |
| `auth-users.json` | — | — | In .gitignore. Never commit. Managed by auth-service. |
| `channel-reads.json` | — | — | In .gitignore. Managed by channel-service. |
| `clubs.json` | open | — | Static club data. |

## scripts/ — Validation and ops

| File | Level | Notes |
|---|---|---|
| `validate-post-metadata.js` | open | Run before handoff if it exists. |
| `validate-locations.js` | open | Run before handoff if it exists. |
| `snapshot-feed.js` | open | Feed snapshot tool. |
| `seed-photo-post-candidates.js` | open | Data seeding tool. |

New scripts are encouraged. Place under `scripts/`.

## docs/agent/ — Documentation

All files under `docs/agent/` are open. This is the primary coordination layer.

- `tasks/` — task definitions
- `handoffs/` — task handoffs
- `domains/` — domain documentation
- `templates/` — templates for tasks and handoffs

## High-conflict file modification process

Before modifying a high-conflict file:

1. Read the current task doc in `docs/agent/tasks/`
2. Check `docs/agent/05_TASK_BOARD.md` for who owns the file
3. If hard-review, notify the owner before merging
4. Keep changes minimal and scoped to your task

After modifying a high-conflict file:

1. Run `node --check` on the file
2. Run relevant validation scripts
3. Test the affected user flow manually
4. Document what changed and why in your handoff
