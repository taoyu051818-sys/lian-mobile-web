# Product Analytics Privacy Contract

Status: draft implementation contract for issue #158.

Related to #158.
Part of #158.
Does not close #158.

## Purpose

This document defines the frontend contract for product analytics in `lian-mobile-web` before any runtime telemetry transport or third-party SDK is introduced. The goal is to make later implementation reviewable, privacy-safe, and consistent across feed, detail, publish, messages, map, notifications, AI, and PWA surfaces.

## Scope

This contract covers:
- event naming and taxonomy
- allowed and forbidden property classes
- consent and reduced-tracking rules
- identity separation rules
- impression, batching, and offline policy
- engineering boundaries for future `trackEvent()` work

This contract does not cover:
- vendor selection
- analytics SDK wiring
- backend ingest implementation
- consent UI implementation
- experimentation or recommendation ranking logic

## Source-of-truth rules

- Frontend code must call one wrapper entrypoint such as `trackEvent()` instead of talking directly to a vendor SDK.
- The wrapper contract must reject or strip forbidden fields in development and test environments.
- Later runtime work must preserve the privacy rules in this document even if transport or storage details change.

## Event taxonomy

All event names should be lowercase snake_case and grouped by user intent rather than by page implementation.

Recommended top-level families:
- `screen_view`
- `content_impression`
- `content_open`
- `content_action`
- `publish_submit`
- `search_submit`
- `notification_open`
- `ai_flow`
- `pwa_prompt`
- `error_recovery`

Recommended first bounded event set:
- `feed_card_impressed`
- `feed_card_opened`
- `post_liked`
- `post_saved`
- `post_shared`
- `post_reported`
- `publish_submitted`
- `publish_succeeded`
- `notification_opened`
- `ai_preview_requested`
- `ai_publish_succeeded`
- `pwa_install_prompted`
- `pwa_installed`

## Event envelope

Every future product event should fit one normalized envelope.

```ts
type ProductAnalyticsEvent = {
  eventId: string
  eventName: string
  schemaVersion: number
  occurredAt: string
  source: 'feed' | 'detail' | 'publish' | 'messages' | 'map' | 'notification' | 'ai' | 'pwa'
  entityType?: 'post' | 'message' | 'place' | 'notification' | 'ai_flow' | 'pwa'
  entityId?: string
  requestId?: string
  rank?: number
  rankBucket?: string
  properties?: Record<string, unknown>
}
```

Rules:
- `schemaVersion` is required so property changes are reviewable.
- `source` is required for cross-surface analysis.
- `entityId` is optional and must never be replaced with raw content.
- `properties` must be allowlisted per event, not free-form.

## Privacy levels

Every property must be assigned one privacy level before it is allowed into analytics.

- `coarse_public`: safe enums, booleans, count buckets, source names, surface names.
- `coarse_behavioral`: rank bucket, result kind, action kind, error kind, retry kind.
- `pseudonymous_limited`: short-lived anonymous session identifiers reviewed for storage and reset behavior.
- `sensitive`: fields that need explicit product and privacy review before any collection.
- `forbidden`: fields that must never leave the client through product analytics.

## Forbidden fields

The frontend wrapper must reject or strip these by default:
- post body text or HTML
- reply text or HTML
- channel message content
- raw search query text
- image URLs
- invite codes
- exact latitude or longitude
- alias identifiers
- real user identifiers unless a separate privacy review explicitly allows them
- full `clientId` or `readerId`
- notification body text
- AI prompt or generated body text
- full external URLs when they reveal private content context

Preferred replacements:
- use category enums instead of raw text
- use count buckets instead of exact counts when exactness is not required
- use source or rank buckets instead of full recommendation payloads
- use coarse place or content type identifiers only after review

## Consent and reduced tracking

Default contract:
- product analytics is opt-in by implementation decision, not implied by this doc alone
- if analytics ships before a user-facing control exists, the default transport should remain disabled outside explicitly approved environments
- browser privacy signals such as DNT or GPC should move the wrapper into reduced-tracking or no-op mode unless a later reviewed decision says otherwise

Required future states:
- `disabled`: no product analytics events leave the client
- `reduced`: only low-risk coarse events are allowed
- `enabled`: allowlisted event set may be emitted

The consent state must be checked by the wrapper, not reimplemented in each feature surface.

## Identity separation

Product analytics identity must stay separate from auth, alias, and messaging identity.

Rules:
- do not reuse `clientId`, `readerId`, alias IDs, invite codes, or real account identifiers as analytics identity
- if an anonymous analytics identifier is added later, it should be short-lived and resettable
- logout, account switch, or local-data reset must rotate or clear any analytics identity and queued analytics payloads
- analytics identity must not silently stitch together anonymous and authenticated use without a reviewed decision

## Impression and de-duplication policy

Impression-style events must be rate-aware and de-duplicated.

Minimum contract:
- use visibility-based triggers rather than raw scroll events
- require a minimum visible ratio and dwell time before counting an impression
- de-duplicate by `eventName + entityId + source + requestId` within a short window
- apply sampling or batching for high-volume impression streams

## Offline, batching, and retry policy

Until a reviewed implementation lands, the default policy is conservative.

Rules:
- no persistent offline queue for product analytics by default
- if a queue is later introduced, it must avoid storing sensitive or forbidden fields
- logout and local-data reset must clear pending analytics payloads
- retries must be bounded and must not mutate the original event payload beyond transport metadata
- transport failure should never block the primary user action

## Engineering boundary for future implementation

When implementation begins, the preferred frontend layout is:

```txt
src/analytics/
  events.ts
  privacy.ts
  consent.ts
  trackEvent.ts
  transport.ts
```

Rules for that layer:
- components call `trackEvent()` only
- no direct vendor SDK calls from Vue components or composables
- event definitions must declare allowed properties
- tests must cover forbidden-field rejection and consent gating

## Review checklist

A future implementation is not ready unless it can answer yes to these questions.

- Does every event have a stable name, owner, and schema version?
- Are properties allowlisted per event instead of being free-form?
- Can the wrapper reject forbidden fields in development and tests?
- Does the contract avoid UGC text, image URLs, exact location, alias IDs, and full client identifiers?
- Does logout or local reset clear analytics identity and queued payloads?
- Can high-volume impression events be sampled or batched?
- Is the transport optional so the event layer can exist without a third-party SDK?

## Follow-up slices suggested by this contract

- typed `src/analytics/**` foundation with tests and no transport
- privacy guard for forbidden keys in development and test
- consent state contract and no-op wrapper behavior
- reviewed backend ingest policy only after the frontend wrapper is stable
