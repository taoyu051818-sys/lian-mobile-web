# Strategy: LIAN as a Campus Experiment Commons

Status: accepted for #70
Date: 2026-05-06
Scope: product strategy and system framing only; no runtime changes
Related: #63, #67, #69

## Vision

LIAN should start as a campus information product, but can evolve into a campus experiment commons: a shared place where students turn campus knowledge, places, projects, events, and resources into durable co-built objects.

A pure feed is good for discovery, but weak at memory. Campus life produces fragments that should not disappear after one post:

- a dining hall tip;
- a study spot correction;
- a club recruitment thread;
- a course survival guide;
- a student project looking for collaborators;
- an event with changing logistics;
- a shared resource list that improves over time.

The strategic opportunity is to let LIAN preserve these fragments as evolving campus objects instead of only ranking them as feed items.

## First co-building object: PlaceSheet

PlaceSheet is the right first experiment because it is concrete, useful, and already connected to MVP flows.

PlaceSheet already has the primitives LIAN needs:

- stable identity through `PlaceRef`;
- visible surface through PlaceSheet bottom-sheet;
- provenance through `source` metadata;
- trust or state through structured `status`;
- user-facing context through posts, recent activity, and corrections.

PlaceSheet lets LIAN test co-building without inventing a broad platform prematurely.

## How actor/source/PlaceSheet patterns scale

### Actor

Actor is display identity. In a co-building system, actor answers: who is speaking, who contributed a post or correction, how to read the contribution in context. Actor should not be replaced by source/provider metadata.

### source

Source is provenance metadata. It answers: where did this object come from, was it imported or user-submitted, what freshness risk may apply. Source should not appear as identity UI, author UI, or trust badge.

### PlaceRef

PlaceRef is stable place identity. It allows scattered posts, map pins, publish payloads, and future corrections to refer to the same campus place. Frontend must not parse free text into stable PlaceRef.

### Scaling pattern

These three primitives form a reusable contract for any future co-building object:

1. **Stable identity** (like PlaceRef) gives the object a durable anchor.
2. **Display actor** (like actor) gives contributions a human-readable author.
3. **Provenance metadata** (like source) gives the object traceable origin without becoming identity.

When LIAN introduces Event, Project, Guide, or Resource objects, each should follow the same contract: stable ID + display actor + provenance source. This avoids inventing per-object identity systems.

## Next possible objects

After PlaceSheet proves the model:

- **Event** -- changing time/location, participant notes, organizer updates. Risk: calendar complexity too early.
- **Project** -- student experiments, hackathon teams, mutual-aid. Risk: stronger permission models needed.
- **Guide** -- course survival, campus onboarding, international student guides. Risk: moderation becomes heavy.
- **Resource** -- shared links, forms, templates. Risk: broken-link maintenance workflows.

Each should wait until PlaceSheet contribution patterns are validated.

## What to avoid (premature implementation)

Do not build these before the object identity contract is stable:

- points, levels, ranks, or leaderboards;
- contribution streaks or competitive mechanics;
- strong real-name identity or global reputation;
- complex permission models;
- public scoreboards or contribution graphs;
- provider/source labels as trust badges or identity UI;
- direct edits to canonical objects without review.

Early contributors should feel their correction helped others and their contribution is traceable -- not that they are climbing a rank ladder.

## Non-goals

This document does not implement:

- PlaceSheet UI changes;
- backend DTO changes;
- object routes or contribution APIs;
- moderation workflows;
- identity system changes;
- points, ranks, badges, or leaderboards;
- runtime or deploy operations.

## Traceability

- #63: actor/source and PlaceSheet contract review
- #67: e2e acceptance for actor/source and PlaceSheet contracts
- #69: PlaceSheet product surface decision
- Full strategy expansion: `docs/strategy/campus-experiment-commons.md`
