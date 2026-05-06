# LIAN as a Campus Experiment Commons

Status: strategy proposal for #70  
Date: 2026-05-06  
Scope: product strategy and system framing only

## One-line direction

LIAN should start as a campus information product, but can evolve into a campus experiment commons: a shared place where students turn campus knowledge, places, projects, events, and resources into durable co-built objects.

## Why this matters

A pure feed product is good for discovery, but weak at memory.

Campus life has many fragments that should not disappear after one post:

- a dining hall tip;
- a study spot correction;
- a club recruitment thread;
- a course survival guide;
- a student project looking for collaborators;
- an event with changing logistics;
- a shared resource list that improves over time.

The strategic opportunity is to let LIAN preserve these fragments as evolving campus objects instead of only ranking them as feed items.

## What to learn from GitHub

LIAN can learn from GitHub's collaboration structure without copying GitHub's interface surface.

Useful GitHub-like patterns:

- durable objects with stable identity;
- contribution history;
- discussion around changes;
- lightweight review before canonical state changes;
- forks/drafts/proposals as safe experimentation space;
- issue-like tracking for improvements;
- visible provenance without turning provenance into social hierarchy.

Patterns to avoid copying too early:

- repository-heavy navigation metaphors;
- developer-specific mental models;
- public scoreboards;
- complex permission models;
- premature contribution graphs;
- points, levels, ranks, or strong identity systems.

## First co-building object: PlaceSheet

PlaceSheet is the right first experiment because it is concrete, useful, and already connected to MVP flows.

PlaceSheet already has the primitives LIAN needs:

- stable identity through `PlaceRef`;
- visible surface through PlaceSheet;
- provenance through `source` metadata;
- trust or state through structured `status`;
- user-facing context through posts, recent activity, and corrections.

PlaceSheet lets LIAN test co-building without inventing a broad platform prematurely.

## System primitives

### Actor

Actor is display identity.

In a co-building system, actor should answer:

- who is speaking;
- who contributed a post, reply, correction, or note;
- how the user should read the contribution in context.

Actor should not be replaced by source/provider metadata.

### identityTag

identityTag is an optional signal.

It can help users understand a contribution, but it should not become the speaking subject. Examples:

- verified campus member;
- club account;
- maintenance volunteer;
- official office account.

Avoid turning identityTag into rank or status competition.

### source

Source is provenance metadata.

It should answer:

- where did this object or update come from;
- was it imported, user-submitted, map-derived, or system-generated;
- what kind of review or freshness risk may apply.

Source should not appear as identity UI, author UI, or trust badge unless a later product decision maps it carefully.

### PlaceRef

PlaceRef is stable place identity.

It allows scattered posts, map pins, publish payloads, and future corrections to refer to the same campus place.

Frontend should not parse free text into stable PlaceRef.

### PlaceSheet

PlaceSheet is the first durable object surface.

It should collect:

- summary;
- status;
- recent posts;
- corrections;
- contribution affordances;
- save/follow behavior if later approved.

## Next possible co-building objects

After PlaceSheet proves the model, LIAN can consider additional object types.

### Event

Useful for:

- changing time/location details;
- participant notes;
- organizer updates;
- post-event summaries.

Risk:

- too much calendar/product complexity too early.

### Project

Useful for:

- student experiments;
- hackathon teams;
- campus research groups;
- mutual-aid initiatives.

Risk:

- may require stronger contribution and permission models.

### Guide

Useful for:

- course survival notes;
- campus onboarding;
- international student guides;
- food/study/location recommendations.

Risk:

- moderation and canonical editing can become heavy.

### Resource

Useful for:

- shared links;
- forms;
- tool lists;
- templates;
- official/unofficial documents.

Risk:

- source freshness and broken links require maintenance workflows.

## Product sequencing

### Phase 0: MVP acceptance

Goal: prove actor/source and PlaceSheet contracts without expanding scope.

Required:

- actor is display identity;
- identityTag is optional signal;
- source stays provenance metadata;
- PlaceRef is stable place identity;
- fallback locationArea remains display-only text;
- e2e acceptance from #67 passes.

Do not add platform strategy work to #63.

### Phase 1: PlaceSheet as durable preview

Goal: make PlaceSheet a useful lightweight object surface.

Possible additions:

- stable title/summary;
- recent posts;
- neutral status display;
- correction entry point;
- save/follow exploration;
- share link only if canonical place URLs exist.

### Phase 2: Contribution workflow

Goal: allow users to improve a place without corrupting canonical identity.

Possible additions:

- suggest correction;
- propose duplicate merge;
- add note or tip;
- submit missing metadata;
- review queue or moderator acceptance state.

### Phase 3: Object graph

Goal: connect places, posts, events, projects, guides, and resources.

Possible additions:

- related objects;
- object history;
- lightweight discussion;
- contributor attribution;
- object-level notifications.

## Contribution design principles

### Start with usefulness, not gamification

Do not start with points, levels, ranks, contribution streaks, or leaderboards.

Early LIAN contributors should feel:

- their correction helped others;
- their note improved campus knowledge;
- their contribution is traceable and reversible;
- they can experiment safely.

### Keep identity soft

Avoid forcing strong real-name identity unless a specific risk requires it.

Support:

- display actor;
- optional identityTag;
- contextual contribution history;
- scoped official/club accounts when needed.

Avoid:

- global reputation rank;
- competitive identity badges;
- provider/source as identity;
- permanent public scoring of students.

### Make provenance visible but secondary

Users should be able to understand where information came from, but source should not dominate UI.

Recommended hierarchy:

1. object content;
2. object state/status;
3. contributor actor;
4. secondary provenance/source disclosure.

## Risks

### Overbuilding before MVP validation

Strategic platform work must not block:

- auth stabilization;
- deploy-state verification;
- actor/source acceptance;
- PlaceSheet MVP acceptance.

### Confusing source with identity

If LIAN treats provider/source labels as speakers, it will weaken trust and repeat the original actor/source contract issue.

### Premature social hierarchy

Points and ranks can distort campus contribution behavior before LIAN understands useful contribution loops.

### Editing without review

Allowing direct edits to canonical campus objects without review can damage trust. Corrections should start as proposals or reviewable events.

## Near-term recommendations

1. Close #63 only after e2e validation confirms the accepted contracts.
2. Keep #66 motion, #68 cleanup, #69 design, and #70 strategy separate.
3. Treat PlaceSheet as the first co-building object, not as a full platform launch.
4. Do not build points, levels, ranks, or strong identity systems in MVP.
5. Use source/status as structured metadata; do not turn them into identity UI.
6. Add correction/contribution only after the object identity contract is stable.

## Traceability

Related work:

- #63: actor/source and PlaceSheet contract review follow-up
- #67: e2e acceptance for actor/source and PlaceSheet contracts
- #69: PlaceSheet product surface decision
- #68: legacy actor/place fallback cleanup after DTO stabilization

## Non-goals

This document does not implement:

- PlaceSheet UI changes;
- backend DTO changes;
- object routes;
- contribution APIs;
- moderation workflows;
- identity system changes;
- points, ranks, badges, or leaderboards;
- runtime/deploy operations.
