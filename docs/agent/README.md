# Agent Docs Index

This directory is the working memory for Codex threads. Treat newer task and handoff files as more specific than older baseline documents.

## Thread Workflow

Default division of labor:

- Codex / code thread: project management, planning, architecture decisions, review, acceptance, and docs status.
- Claude Code thread: implementation inside the approved task boundary.

Do not treat executor handoffs as acceptance. A lane becomes accepted only when the Codex / code review records the validation result in `05_TASK_BOARD.md` or the corresponding task doc.

## Start Here

Read these in order before starting implementation work:

1. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files
2. `ARCHITECTURE_WORKPLAN.md` - current architecture direction and work organization
3. `05_TASK_BOARD.md` - current done/ready/risky items
4. `03_FILE_OWNERSHIP.md` - ownership and conflict boundaries
5. `PROJECT_FILE_INDEX.md` - canonical file index with status, owner, repo split destination
6. `04_DECISIONS.md` - recorded architecture/product decisions
7. `domains/<area>.md` - domain context for the task area
8. `tasks/<task>.md` - current task specification, if present
9. `handoffs/<task>.md` - latest thread handoff, if present

## Current Domain Docs

- `domains/AI_POST_PREVIEW.md` - AI preview and light publish scope
- `domains/AUDIENCE_SYSTEM.md` - audience/permission model direction
- `domains/FEED_SYSTEM.md` - feed, metadata, scoring, and debug context
- `domains/MAP_SYSTEM.md` - Map v1/v2, location data, editor, and future map work
- `domains/NODEBB_INTEGRATION.md` - NodeBB endpoints, auth modes, posting path, and failure modes

## Current Task Docs

Use `tasks/` for active or ready-to-resume implementation specs. A task doc should describe scope, allowed files, acceptance criteria, validation, and rollback notes.

Notable ready/resumable work:

- `tasks/project-file-index-and-doc-cleanup.md`
- `tasks/map-v2-data-assets.md`
- `tasks/map-v2-restore-legacy-geo.md`
- `tasks/audience-permission-design.md`
- `tasks/nodebb-integration-audit.md`
- `tasks/feed-ops-snapshot-diff.md`

## Handoffs

Use `handoffs/` for completed-thread summaries and next-thread instructions. Handoffs are context transfer notes, not new product scope.

Read `handoffs/README.md` for the normalized handoff list.

## References

- `../design/LIAN-Campus-UI-UX-Guidelines-V0.1.md` - LIAN Campus UI / UX Guidelines V0.1: product principles, card system, identity, place sedimentation, glass hierarchy, motion, state, feedback, accessibility, and data trust
- `references/GITHUB_RECENT_UPDATES_2026-05-05.md` - latest GitHub PR/repo-split alignment: backend `lian-platform-server`, frontend `lian-mobile-web`, full-stack retired
- `references/RECENT_WORK_HANDOFF_2026-05-05.md` - latest repo-split and docs handoff, superseding 2026-05-04 for GitHub orientation
- `references/HIGH_RISK_AREAS.md` - 6 high-risk area audits (frontend load order, feed scoring, NodeBB integration, auth, metadata format, route structure)
- `references/GITHUB_RECENT_UPDATES_2026-05-04.md` - historical GitHub commit summary and deployment implications; superseded for repo ownership
- `references/RECENT_WORK_HANDOFF_2026-05-04.md` - historical long-thread handoff; superseded for repo ownership

## Historical References

These files are useful for history but should not override newer docs or code:

- `01_PROJECT_FACT_BASELINE.md` - early fact baseline; some facts are superseded by Map v2 and frontend split work
- `MAP_V2_TECH_PLAN.md` - early Map v2 implementation plan; MVP implementation and editor work have since landed
- `domains/FEED_REFACTOR_PLAN.md` - feed refactor planning reference

When docs disagree, prefer this order:

1. Current code
2. Latest handoff for the task area
3. Current task doc
4. `PROJECT_FILE_INDEX.md` - canonical file index
5. `domains/<area>.md` - domain documentation
6. `ARCHITECTURE_WORKPLAN.md`
7. `04_DECISIONS.md`
8. Historical baseline/planning docs
