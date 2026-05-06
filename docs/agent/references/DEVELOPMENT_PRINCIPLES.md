# LIAN Development Principles

Last updated: 2026-05-06

This document is the project-level development principle for LIAN core repositories.
It applies to both `lian-platform-server` and `lian-mobile-web`.

## Core rule: review before implementation for cross-cutting changes

Do not start implementation PRs for cross-cutting product, API, runtime, data, or deployment changes until a review meeting has happened and the decision is recorded.

A draft PR or short investigation branch is allowed only when its purpose is to clarify feasibility. It must not be merged before the review decision is recorded.

## Changes that require an organized review meeting first

A review meeting is required before modifying any of the following areas:

1. Product semantics and user-facing mental models
   - alias / display actor / identity tag / source semantics;
   - post tag, interest, place, trust/status/source labels;
   - changes that affect how students understand identity, credibility, location, or recommendation.

2. API contracts and DTO shapes
   - adding, removing, renaming, or reinterpreting response fields;
   - frontend/backend contract changes such as `actor`, `source`, `PlaceSheet`, share-card payloads;
   - compatibility-window decisions and legacy field removal.

3. Cross-repository behavior
   - any change that requires coordinated work in both `lian-platform-server` and `lian-mobile-web`;
   - migrations where one repository must land before the other;
   - changes to ports, proxy behavior, route ownership, or runtime source of truth.

4. Data model, storage, and migration behavior
   - Redis object-native key design;
   - legacy bulk key migration or deletion;
   - NodeBB data cleanup or mutation;
   - auth/session data, profile/avatar source, post metadata, feed rules, channel read state.

5. Route registry, public entry points, and security boundaries
   - adding/removing public API routes;
   - changing route registry conventions;
   - deploy webhook, forum-gate, auth/session, admin token, upload, or proxy bypass behavior;
   - anything that changes what is publicly reachable.

6. Release, deployment, and operational behavior
   - CI/CD policy, deployment scripts, rollback process, webhook delivery, production ports;
   - staging/production promotion rules;
   - health checks, backup/restore, observability, or incident response behavior.

7. Major UI/product surfaces
   - Feed, Detail, Publish, Messages, Profile, Map, PlaceSheet / PlacePage;
   - user-facing layout changes that alter the primary task flow;
   - retiring legacy/static rehearsal behavior or switching Vue canary to the only supported path.

8. AI-assisted content or recommendation policy
   - feed ranking, curated batches, AI summaries, generated place summaries;
   - trust/confidence labels for AI-organized content;
   - moderation or safety assumptions for generated content.

## Changes that usually do not require a meeting

A review meeting is usually not required for:

- typo, copy, or documentation fixes that do not change policy;
- pure internal refactors that keep route behavior, DTO shapes, data writes, and user-facing behavior unchanged;
- test-only changes that do not alter acceptance criteria;
- small bug fixes with no cross-repository dependency and no product-contract ambiguity.

Even for these changes, open a normal PR and run the relevant checks before merge.

## Required review output

Every required review must leave a durable record in GitHub before implementation PRs are merged.
The record can be an issue comment, decision note, or linked markdown reference.

The record must include:

- decision date;
- participants or decision owner;
- problem statement;
- accepted direction;
- rejected alternatives, if important;
- affected repositories;
- implementation scope and non-goals;
- compatibility and migration plan;
- validation plan;
- rollback or recovery plan when runtime/data/deploy behavior is involved.

## Implementation sequence after review

Use this order for reviewed changes:

1. Record the decision.
2. Split backend/frontend work if both repositories are affected.
3. Land backend contracts first when frontend depends on new API semantics.
4. Keep compatibility fields during a migration window when existing clients may still read them.
5. Update frontend mapping after backend contract is merged.
6. Run repository checks and smoke tests.
7. Close or update the review issue only after validation is complete.

## Current known review gates

The following active areas must stay review-first until closed:

- Display actor semantics across posts, replies, and channel messages.
- PlaceSheet / place sedimentation API for Map, Detail, and Publish flows.
- Message composer identity UI, especially avoiding identity tag as speaking identity.
- Publish place binding simplification.
- Detail page place pill behavior.
- WeChat/share-card backend payload shape.
- Avatar source unification between NodeBB, aliases, and legacy local uploads.
- Legacy NodeBB visible author signature / escaped HTML cleanup.
- Retirement plan for legacy/static frontend behavior and Vue canary promotion.

## Merge rule

If a PR touches a review-required area and there is no linked review decision, do not merge it.
Convert the PR to a draft, open or update the relevant review issue, and organize the review first.
