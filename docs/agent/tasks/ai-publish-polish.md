# Task: ai-publish-polish

## Goal

Polish the AI light publish MVP so it can support multi-image posts, cleaner draft records, and safer user-facing retry behavior.

## Product scope

Users still must review and confirm before publishing. AI does not auto-publish, auto-comment, or bypass NodeBB.

## Allowed files

- `src/server/ai-light-publish.js`
- `src/server/ai-post-preview.js`
- `public/app-ai-publish.js`
- `public/app-utils.js` only if shared upload plumbing is required
- `scripts/archive-ai-records.js`
- `docs/agent/domains/AI_POST_PREVIEW.md`
- `docs/agent/tasks/ai-publish-polish.md`
- `docs/agent/handoffs/ai-publish-polish.md`

## Forbidden files

- `src/server/feed-service.js`
- `data/feed-rules.json`
- `public/map-v2.js`
- `public/tools/map-v2-editor.js`
- `src/server/post-service.js` unless fixing a reviewed shared publish bug

## Data schema changes

Allowed additive changes:

- `imageUrls` in AI draft/publish payloads and JSONL records.
- archive metadata in a new archive file if `scripts/archive-ai-records.js` is implemented.

Do not change the meaning of existing `imageUrl`, `metadata`, `locationDraft`, `riskFlags`, or `aiMode`.

## API changes

Allowed additive fields:

- `POST /api/ai/post-drafts`: accept `imageUrls`.
- `POST /api/ai/post-publish`: accept `imageUrls`.
- `POST /api/ai/post-preview`: may accept multiple image inputs only if fallback behavior remains stable.

## Acceptance criteria

- [ ] Uploading 2+ images through AI publish preserves all images in the NodeBB topic.
- [ ] Existing single-image AI publish still works.
- [ ] Failed silent draft save does not block publish.
- [ ] JSONL archive/cleanup tool can count/list records without corrupting files.
- [ ] No recommendation or map rendering behavior changes.

## Validation commands

```bash
node --check src/server/ai-light-publish.js
node --check src/server/ai-post-preview.js
node --check public/app-ai-publish.js
node --check public/app-utils.js
node --check scripts/archive-ai-records.js
node scripts/validate-post-metadata.js
```

Manual:

1. Log in.
2. Open publish sheet.
3. Upload two images.
4. Confirm preview and edit draft.
5. Publish to LIAN.
6. Verify NodeBB topic contains both images and `post-metadata.json` only updates after successful publish.

## Risks

- Multi-image payloads can increase upload time and memory pressure.
- AI preview may only use the first image in early versions; this must be clearly documented if not solved.
- JSONL cleanup must be append-safe and never rewrite active records without backup.

## Rollback plan

- Revert the task commit.
- Keep existing JSONL files; they do not affect runtime feed.
- If a publish bug reaches production, disable AI publish entry in frontend and keep regular `/api/posts`.

