# Task: Publish V2 Browser Acceptance

## Goal

Verify the Publish V2 user journey in a real browser before marking the main creation path accepted.

## Product scope

This is an acceptance task, not a feature expansion task. It validates that the current Publish page can support real posting from image selection through NodeBB publish and metadata write.

## Allowed files

- `docs/agent/tasks/publish-v2-browser-acceptance.md`
- `docs/agent/handoffs/publish-v2-browser-acceptance.md`
- `docs/agent/05_TASK_BOARD.md`

Runtime files may only be changed if a separate fix task is opened for a concrete bug.

## Forbidden files

- `public/*` for this acceptance task
- `src/server/*` for this acceptance task
- `data/*`
- `server.js`

## Data schema changes

None.

## API changes

None.

## Acceptance criteria

- [ ] Clicking the publish entry opens the dedicated Publish page.
- [ ] Selecting one image and confirming immediately enters Map v2 location picking.
- [ ] Upload continues in the background while the user can choose or skip location.
- [ ] User can confirm a coordinate-bearing Map v2 location.
- [ ] User can skip location and still continue safely.
- [ ] AI preview generates editable title/body/tags after image URLs are ready.
- [ ] Title, body, tags, location, and audience remain editable.
- [ ] Audience picker supports at least public/campus/school/private-equivalent first-cut choices.
- [ ] Regenerate does not silently overwrite user-selected audience.
- [ ] Publish requires explicit user click.
- [ ] Publish creates a NodeBB topic.
- [ ] `post-metadata.json` receives `imageUrls`, `locationDraft`, audience/visibility, and distribution fields after successful publish.
- [ ] Feed/detail can open the newly published post.
- [ ] Failed publish does not leave a false-success metadata residue.

## Failure-path checks

- [ ] Multi-image successful path works.
- [ ] One image upload failure is visible and removable.
- [ ] If all uploads fail, the user cannot reach final publish.
- [ ] Removing failed images lets the user continue when at least one uploaded URL remains.
- [ ] AI preview failure leaves editable manual fields and does not auto-publish.

## Validation commands

```bash
node scripts/smoke-frontend.js http://localhost:4100
node scripts/validate-post-metadata.js
```

Manual browser flow:

```text
1. Open local app.
2. Click publish entry.
3. Select image(s).
4. Confirm images.
5. Verify immediate Map v2 picker transition.
6. Confirm or skip location.
7. Wait for AI preview.
8. Edit draft and audience.
9. Regenerate and confirm audience is not overwritten.
10. Publish.
11. Verify NodeBB topic, metadata, feed, and detail.
```

## Risks

- Risk: Acceptance task turns into UI redesign. Mitigation: record bugs and open separate fix tasks.
- Risk: Test posts pollute production data. Mitigation: use local/staging environment and clean up according to existing test-data policy.
- Risk: Browser acceptance depends on real upload/NodeBB services. Mitigation: record environment, account, and service status in handoff.

## Rollback plan

- If acceptance fails, keep Publish V2 in pending browser acceptance and open targeted fix tasks.
- Do not revert Publish V2 wholesale unless it blocks the existing production publish path.
