# Task: Audience Write-Side Minimum Enforcement Audit

## Goal

Audit publish paths to ensure they write safe audience/visibility metadata and do not allow obvious audience escalation.

## Product scope

This is a P1 audit and minimum-enforcement planning task. It should not expand LIAN into a full organization permission platform.

## Allowed files

- `src/server/audience-service.js`
- `src/server/post-service.js`
- `src/server/ai-light-publish.js`
- `docs/agent/tasks/audience-write-side-minimum-audit.md`
- `docs/agent/handoffs/audience-write-side-audit.md`
- `docs/agent/05_TASK_BOARD.md`

Implementation changes are optional and must be limited to minimum write-side checks if the audit finds a clear bug.

## Forbidden files

- `public/*`, unless a separate product task explicitly changes the audience picker
- `data/feed-rules.json`
- Map v2 editor files
- NodeBB group/category sync
- Database schema or ORM setup
- Full organization admin UI

## Data schema changes

No broad schema changes.

The audit should confirm whether newly created post metadata includes:

```json
{
  "visibility": "public",
  "audience": {
    "visibility": "public",
    "schoolIds": [],
    "orgIds": [],
    "roleIds": [],
    "userIds": [],
    "linkOnly": false
  }
}
```

Exact shape may follow the current Audience model, but missing audience must have a documented safe default.

## API changes

None expected.

If minimum enforcement is added, it must preserve current supported publish flows:

- `POST /api/posts`
- `POST /api/ai/post-publish`

## Audit checklist

- [ ] Inspect `/api/posts` manual publish path.
- [ ] Inspect `/api/ai/post-publish` AI publish path.
- [ ] Confirm baseline metadata is written after successful NodeBB topic creation.
- [ ] Confirm missing audience gets a safe default.
- [ ] Confirm `metadata.visibility` and structured `audience` do not conflict silently.
- [ ] Confirm user-selected audience wins over AI preview/regenerate output.
- [ ] Confirm AI preview cannot decide final audience by itself.
- [ ] Confirm final publish payload writes both current compatibility `visibility` and future-facing audience object.
- [ ] Identify whether `canCreatePostWithAudience()` exists and whether it is called.
- [ ] If it is not called, record the minimum safe call sites and expected behavior.

## Minimum first-cut enforcement

Only consider these first-cut scopes:

- public;
- campus;
- school;
- private/self;
- linkOnly distribution behavior if already exposed.

Do not include:

- `roleIds`;
- `multiOrg`;
- `multiSchool`;
- NodeBB groups sync;
- NodeBB plugin;
- organization management UI.

## Validation commands

If code changes are made:

```bash
node --check src/server/audience-service.js
node --check src/server/post-service.js
node --check src/server/ai-light-publish.js
node scripts/test-audience-hydration.js
node scripts/validate-post-metadata.js
```

Manual spot checks:

```text
Create manual public post -> metadata has visibility + audience.
Create AI post with user-selected campus/school/private audience -> metadata preserves user choice.
Regenerate AI preview -> final audience remains user-selected.
```

## Risks

- Risk: Audit becomes a full permission platform. Mitigation: stop at minimum write-side checks and record future work separately.
- Risk: Over-strict checks block normal posting. Mitigation: preserve current public/campus/default flows and test them manually.
- Risk: AI output can overwrite user selection. Mitigation: final publish payload should use user-confirmed audience only.

## Rollback plan

- If minimum enforcement blocks posting, revert the enforcement call sites and keep the audit findings as planning notes.
