# Task: audience-permission-design

## Goal

Design LIAN's school/org audience model and permission checks before implementing multi-school or organization-scoped visibility.

## Product scope

This is a design task. It defines how different users, schools, organizations, roles, and link-only/private content will be represented and checked.

## Allowed files

- `docs/agent/domains/AUDIENCE_SYSTEM.md`
- `docs/agent/domains/NODEBB_INTEGRATION.md`
- `docs/agent/tasks/audience-permission-design.md`
- `docs/agent/handoffs/audience-permission-design.md`

## Forbidden files

- Runtime code under `src/server/*`
- Runtime frontend files under `public/*`
- Runtime data under `data/*`

## Data schema changes

Design only. Do not modify runtime data.

The design should cover future shapes for:

- `schools`
- `organizations`
- `organization_memberships`
- `post_audience`
- `audit_logs`

## API changes

Design only. Do not implement.

The design should identify future API requirements:

- `GET /api/audience/options`
- `GET /api/schools`
- `GET /api/orgs/my`
- audience fields on post create / AI publish
- audience-aware `GET /api/feed`
- audience-aware `GET /api/posts/:tid`
- audience-aware map/search/channel surfaces

## Required design outputs

- [ ] Audience schema with `visibility`, `schoolIds`, `orgIds`, `roleIds`, `userIds`, and `linkOnly`.
- [ ] Permission functions:
  - `canViewPost(user, post)`
  - `canCreatePostWithAudience(user, audience)`
  - `canReplyToPost(user, post)`
  - `canModeratePost(user, post)`
  - `canSeeAudienceOption(user, option)`
- [ ] Required enforcement points:
  - feed
  - feed-debug
  - detail
  - replies
  - map
  - search
  - channel
  - messages/notifications
- [ ] NodeBB mirror strategy for groups/categories.
- [ ] Raw NodeBB topic link leakage analysis.
- [ ] Migration plan from current `visibility` metadata field.

## Risks

- If audience is only filtered in feed, private content may leak through detail, map, search, or NodeBB raw links.
- `linkOnly` must not mean public. It only means "not naturally distributed."
- NodeBB groups/categories cannot represent every dynamic audience combination cleanly.

## Rollback plan

- Revert docs.
- Do not implement code in this task.

