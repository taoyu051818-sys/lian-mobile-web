# Agent Docs Index

This directory is the working memory for Codex threads. Treat newer task and handoff files as more specific than older baseline documents.

## Start Here

Read these in order before starting implementation work:

1. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files
2. `ARCHITECTURE_WORKPLAN.md` - current architecture direction and work organization
3. `05_TASK_BOARD.md` - current done/ready/risky items
4. `03_FILE_OWNERSHIP.md` - ownership and conflict boundaries
5. `04_DECISIONS.md` - recorded architecture/product decisions
6. `domains/<area>.md` - domain context for the task area
7. `tasks/<task>.md` - current task specification, if present
8. `handoffs/<task>.md` - latest thread handoff, if present

## Current Domain Docs

- `domains/AI_POST_PREVIEW.md` - AI preview and light publish scope
- `domains/AUDIENCE_SYSTEM.md` - audience/permission model direction
- `domains/FEED_SYSTEM.md` - feed, metadata, scoring, and debug context
- `domains/MAP_SYSTEM.md` - Map v1/v2, location data, editor, and future map work
- `domains/NODEBB_INTEGRATION.md` - NodeBB endpoints, auth modes, posting path, and failure modes

## Current Task Docs

Use `tasks/` for active or ready-to-resume implementation specs. A task doc should describe scope, allowed files, acceptance criteria, validation, and rollback notes.

Notable ready/resumable work:

- `tasks/map-v2-data-assets.md`
- `tasks/map-v2-restore-legacy-geo.md`
- `tasks/audience-permission-design.md`
- `tasks/nodebb-integration-audit.md`
- `tasks/feed-ops-snapshot-diff.md`

## Handoffs

Use `handoffs/` for completed-thread summaries and next-thread instructions. Handoffs are context transfer notes, not new product scope.

Read `handoffs/README.md` for the normalized handoff list.

## References

- `references/HIGH_RISK_AREAS.md` — 6 个高风险区域结构化调研（前端加载顺序、Feed 评分、NodeBB 集成、认证系统、metadata 格式、路由结构）

## Historical References

These files are useful for history but should not override newer docs or code:

- `01_PROJECT_FACT_BASELINE.md` - early fact baseline; some facts are superseded by Map v2 and frontend split work
- `MAP_V2_TECH_PLAN.md` - early Map v2 implementation plan; MVP implementation and editor work have since landed
- `domains/FEED_REFACTOR_PLAN.md` - feed refactor planning reference

When docs disagree, prefer this order:

1. Current code
2. Latest handoff for the task area
3. Current task doc
4. `ARCHITECTURE_WORKPLAN.md`
5. `04_DECISIONS.md`
6. Historical baseline/planning docs
