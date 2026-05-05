# Task: NodeBB Native Capability Inventory

## Goal

Audit NodeBB native capabilities that LIAN has not yet connected, then wait for a product decision on the first integration cut.

This is a planning task. Do not implement likes, favorites, reports, or history until the product cut is explicitly chosen.

## Candidate Capabilities

### Like / Upvote

Possible LIAN meaning:

- appreciation;
- "useful";
- lightweight quality signal.

Likely surfaces:

- feed card;
- post detail;
- future feed-debug signal display.

First-cut rule:

- Display/action only.
- Do not change recommendation score in the same PR.

### Save / Favorite / Bookmark

Possible LIAN meaning:

- save a post;
- collect a place memory;
- keep useful campus info.

Likely surfaces:

- feed card;
- post detail;
- profile "saved" section.

Must enforce audience:

- a saved private/school/org post must still pass `canViewPost`.

### Browsing History / Read State

Possible LIAN meaning:

- visited marker;
- unread badge;
- continue reading;
- lightweight activity history.

Likely surfaces:

- feed card visited state;
- detail page marks read;
- messages/unread page;
- optional profile history.

Privacy rule:

- mark read on detail open, not on card impression.
- do not expose another user's reading history.

### Report / Flag

Possible LIAN meaning:

- privacy issue;
- false information;
- abuse;
- wrong location;
- expired content;
- visibility/audience mistake.

Likely surfaces:

- post detail overflow menu;
- feed card menu;
- future admin moderation queue.

First-cut rule:

- must define where operators see reports before enabling broad reporting.

### Topic Edit / Delete / Hide

Possible LIAN meaning:

- author correction;
- admin takedown;
- expired content cleanup.

Likely surfaces:

- detail author menu;
- admin moderation UI.

Risk:

- must keep LIAN metadata and NodeBB topic state in sync.

### Groups / Category Privileges

Possible LIAN meaning:

- hard boundary mirror for schools/orgs;
- public/campus/restricted categories.

Likely surfaces:

- audience system;
- auth/admin tools.

Rule:

- LIAN owns school/org membership first.
- NodeBB groups/categories mirror hard access boundaries.

## Required Pre-Implementation Audit

For each selected capability:

1. Confirm NodeBB version and exact endpoint.
2. Confirm whether endpoint is topic-level or post-level.
3. Confirm required auth header and `_uid` behavior.
4. Confirm response shape.
5. Confirm idempotency behavior.
6. Confirm what happens when user lacks permission.
7. Decide source of truth:
   - NodeBB only;
   - NodeBB with LIAN cache;
   - LIAN state with NodeBB mirror.
8. Add failure-mode notes to `docs/agent/domains/NODEBB_INTEGRATION.md`.

## Recommended First Cuts

Recommended order:

1. Report / flag, because governance is foundational.
2. Save / favorite, because it helps users without changing public ranking.
3. Like / useful, because it is visible and may later affect ranking.
4. Read state / browsing history, because it has privacy considerations.
5. Groups/categories, once audience implementation begins.

## Non-Goals

- No implementation in this task.
- No feed ranking changes.
- No private messages.
- No gamified reputation system.
- No NodeBB plugin unless a later task explicitly approves it.
