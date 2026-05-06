# Legacy Actor/Place Fallback Cleanup Plan

Status: proposal for #68  
Date: 2026-05-06  
Scope: frontend cleanup plan only

## Context

Legacy fallback fields exist in types and frontend layers:

- `author`, `username`, `displayName`
- `authorAvatarUrl`, `authorIdentityTag`, `identityTag`
- `locationArea`
- `location.id` as temporary place id fallback

These are kept to avoid breaking UI before DTO stabilization, but they may mask contract drift.

## Cleanup Principles

1. Only remove legacy fields after confirming backend DTO contracts are stable for `actor` and `PlaceRef`/`PlaceSheet`.
2. Remove in stages per frontend module to avoid breaking e2e.
3. Ensure all UI elements rely solely on canonical fields.
4. Add runtime warnings if legacy payloads are present to alert developers.

## Stage 1: Feed

- Replace `item.author` / `item.authorAvatarUrl` / `item.authorIdentityTag` / `item.locationArea` usage with `item.actor` and `item.source`.
- Keep fallback only for legacy DTO until stage 2.
- Verify feed e2e acceptance passes.

## Stage 2: Post Detail

- Remove `post.author` / `post.authorAvatarUrl` / `post.authorIdentityTag` / `post.locationArea`.
- Migrate all display to `post.actor`, `post.source`, and `post.place`.
- Verify PostDetailPanel e2e acceptance passes.

## Stage 3: Map

- Remove `mapPost.locationArea` / `mapPost.author*` usage.
- Replace with `mapLocation.place` and `mapLocation.actor` where available.
- Keep display-only text only for unknown place (no `PlaceRef`).

## Stage 4: Publish

- Remove `locationDraft.locationArea` and `identityTag` fallback display.
- Ensure payload uses `locationDraft.placeId` / `place` correctly.
- Success UI displays `response.place.name` or submitted text when `PlaceRef` absent.

## Regression & QA

- Add warnings or checks if legacy fields appear in DTO.
- Verify #63 e2e acceptance after each stage.
- Document any remaining fallback usage until full removal.

## Non-goals

- Do not change PlaceSheet UI semantics.
- Do not mix with auth, motion, deploy, or strategy issues.
- Do not guess runtime commands, ports, or service names.
