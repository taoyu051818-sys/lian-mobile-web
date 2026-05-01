# Architecture And Product Decisions

This numbered file is the current decision log for future Codex threads. Older root docs under `docs/agent/` are historical context and should not override this file unless a newer dated decision is added.

## 2026-05-01: NodeBB Remains The Content Backend

NodeBB continues as the content backend and system of record for topics, posts, replies, users, tags, categories, permissions, and moderation primitives.

LIAN should not rebuild forum/content infrastructure. LIAN remains the campus experience layer.

## 2026-05-01: LIAN Owns Campus Experience Layer

LIAN is responsible for recommendation, map experience, local metadata, and AI-assisted lightweight posting.

These are product-specific layers that NodeBB does not provide in a student-campus-native way.

## 2026-05-01: AI Suggestions Are Draft-Only

AI may generate titles, body drafts, tags, location suggestions, content type guesses, and risk/privacy hints, but it must only produce drafts or suggestions.

The AI post preview endpoint must not publish, must not call NodeBB post creation, and must not write `data/post-metadata.json`.

## 2026-05-01: AI Post Preview Backend Is Completed

`POST /api/ai/post-preview` has been implemented and tested in both mock and MiMo modes. The endpoint includes MiMo adapter logic, prompt construction, JSON parsing, normalization, and `imageBase64` length limits.

The endpoint can accept Cloudinary/public image URLs and returns normalized preview output with `mode=mimo` when MiMo succeeds.

Real `MIMO_API_KEY` values are allowed only in `.env` or server environment variables. They must never be committed.

## 2026-05-01: `locationId` Is The Formal Place Key

`locationId` is the formal stable key for known places. It should connect feed, map, metadata, search, future place pages, and analytics without depending on display text.

## 2026-05-01: `locationArea` Is Legacy Compatibility Text

`locationArea` is compatibility/display text for old or fuzzy data. It is not the formal place key.

Existing data may only have area strings, but new structured workflows should move toward `locationId` plus optional precision fields.

## 2026-05-01: Leaflet Handles Precise Maps

Leaflet is the preferred precise web map layer for calibration, location picking, and coordinate verification.

It should not be added for Map v2 until the design-only technical plan is accepted.

## 2026-05-01: Illustrated Map Handles Visual Exploration

The illustrated campus map remains the default exploration surface.

Students can understand landmarks, memories, routes, and campus vibes faster through a simplified visual map than through a generic GIS-like interface.

## 2026-05-01: Feed Optimization Is Completed

`feedEditions` is no longer an all-page lock for recommendation pages. Recommendation page 1 now combines a small curated entry area with ranked rest:

- `curatedSlotsPerPage: 3`
- `rankedRestOnCuratedPages: true`

Scoring now includes `contentTypeWeights` and `missingLocationAreaPenalty`. Moment scoring now includes `momentContentTypeWeights` and `momentMissingLocationAreaPenalty`.

## 2026-05-01: `feedEditions` Stays But Must Not Lock The Homepage

`feedEditions` remains available for operator control, but it must not permanently lock the entire homepage into curated batches.

Manual curation is useful for launch and operations, but feed quality also needs ranked, observable, local content.

## 2026-05-01: Map V2 Is Design-Only For Now

Map v2 should not be directly implemented yet. First produce and review `MAP_V2_TECH_PLAN.md`.

Until that plan is approved, do not change `public/app.js`, do not add Leaflet, and do not change locations API behavior.

## 2026-05-01: Task Market, Errands, And Drones Are Deferred

Task market, errand/runner workflows, and drone workflows are paused.

The current priority is feed observability, metadata quality, AI draft preview, publishing basics, and map foundations.

