# ADR 0001: Vue 3 + Vite + TypeScript UI Entry

Status: Proposed

Date: 2026-05-04

## Decision

LIAN frontend will use Vue 3 + Vite + TypeScript as the long-term UI architecture direction.

This repository now has two frontend entry modes during migration:

1. Legacy static mobile frontend under `public/`, still served by `npm start` / `npm run start:frontend-static`.
2. New Vue 3 app shell from root `index.html`, mounted by `src/main.ts` through Vite.

The Vue app is intentionally non-invasive at first. It provides the new engineering entry and future component boundary, while the current product experience remains on the legacy static frontend until individual features are migrated and validated.

## Why Vue 3 now

The app is currently template-heavy and DOM-structured. Vue single-file components are a lower-risk migration path than a direct React rewrite because Vue templates map closely to the existing HTML-oriented UI.

Vue 3 is selected now to avoid building another long-lived vanilla architecture that must later be replaced.

## Why not full rewrite now

Do not rewrite all pages at once. High-risk areas must migrate one boundary at a time:

- Publish flow: image upload, map location picking, AI preview, drafts, audience.
- Map v2: Leaflet lifecycle, editor controls, location cards, picking mode.
- Messages: bottom scroll, older message loading, notification switching.
- Detail: gallery, lightbox, replies, feed scroll restoration.
- Auth/avatar crop: dialogs, crop state, profile refresh.

## Migration phases

### Phase 0: Foundation

- Add LIAN UI/UX guidelines.
- Add design tokens.
- Add Vue 3 + Vite + TypeScript entry.
- Keep legacy static frontend running.

### Phase 1: Vue UI primitives

Create Vue components without moving whole pages:

- LianButton
- GlassPanel
- TypeChip
- TagChip
- LocationChip
- TrustBadge
- IdentityBadge
- TopBar
- BottomTabBar
- Sheet
- Toast / InlineError

### Phase 2: Low-risk feature migration

Move low-risk UI surfaces first:

- Static app shell prototypes.
- Top/bottom navigation.
- Toast/feedback system.
- Tag and badge rendering.
- Profile summary widgets.

### Phase 3: Page migration

Recommended order:

1. Profile
2. Messages
3. Detail
4. Feed
5. Publish
6. Map

Publish and Map are intentionally last because they are the highest-risk flows.

## Rules

1. Do not combine visual redesign with behavior migration.
2. Keep legacy public frontend functional until replacement pages are validated.
3. New UI components should use LIAN design tokens.
4. All new frontend modules should be TypeScript.
5. Real browser validation is required before replacing publish, map, messages, detail or auth flows.
6. API contracts should stay outside this repo unless explicitly coordinated with the backend repository.

## Consequences

Positive:

- The long-term framework decision is no longer ambiguous.
- New UI work can start in Vue immediately.
- Existing product behavior remains stable during migration.
- TypeScript can be introduced from new code forward.

Tradeoffs:

- There are temporarily two frontend entry modes.
- Some styles will be shared through `public/lian-tokens.css` until CSS is fully reorganized.
- Legacy global state and event handling remain until page migration begins.
