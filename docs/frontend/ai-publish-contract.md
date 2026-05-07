# AI-Assisted Publish Contract

Frontend contract for the AI-assisted ("AI light") publish flow, covering risk flags, human review, draft lifecycle, image analysis, and EXIF/GPS scrub. Cross-references: #138, #128, #129, #136, #127.

## Files

| Path | Role |
|---|---|
| `public/app-ai-publish.js` | Legacy AI publish flow (DOM innerHTML sheet) |
| `src/api/publish.ts` | Vue publish API helpers (`buildPublishPayload`, `uploadPublishImage`, `publishPost`) |
| `src/views/PublishView.vue` | Vue publish view |
| `src/types/publish.ts` | Shared `PublishPayload`, `PublishLocationDraft`, `PublishVisibility` |

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/upload/image?purpose=ai-light-publish` | POST | Upload image for AI analysis |
| `/api/ai/post-preview` | POST | Generate AI draft (title/body/tags) from image |
| `/api/ai/post-drafts` | POST | Save AI draft server-side |
| `/api/ai/post-publish` | POST | Publish AI-assisted post |
| `/api/upload/image?purpose=publish-v2` | POST | Upload image for Vue manual publish |

## User-Confirmed Publish Safety Boundary

AI-generated content must be confirmed by the user before publishing. The UI must make clear that AI output is a draft, not a final post.

**Contract rules:**

- AI preview generates title/body/tags and fills the form, but the user must review and can edit all fields before submitting.
- A visible disclaimer appears in the AI draft area: "AI-generated content — please confirm accuracy and privacy before publishing."
- The publish CTA must not imply the content is pre-approved or platform-reviewed.
- `needsHumanReview: true` changes the CTA label from "发布到 LIAN" to "提交审核" and the post enters a pending-review state after submission.
- Fields the user must confirm: title, body, tags, location, visibility, identity tag. If any remain unedited after AI preview, a soft prompt nudges the user to review them.

## riskFlags Contract

`riskFlags` is an array returned by `/api/ai/post-preview`. Each flag has a severity level that determines UI behavior.

**Severity levels:**

| Level | UI Behavior | Block publish? |
|---|---|---|
| `blocking` | Red banner in draft area; publish button disabled | Yes |
| `warning` | Yellow banner; publish allowed but user must acknowledge | No |
| `info` | Gray inline note; purely informational | No |

**Flag shape:**

```ts
interface RiskFlag {
  code: string;        // machine-readable, e.g. "sensitive_location", "potential_pii"
  severity: "blocking" | "warning" | "info";
  message: string;     // user-facing copy, integrated with #113 copy catalog
}
```

**Current state:** Legacy `renderAiPublishSheet()` renders all riskFlags as plain `<p>` text regardless of severity. The contract above is the target state.

**Rules:**

- Blocking flags must disable the publish/submit-审核 button and display a red notice explaining why.
- Warning flags display a yellow notice; the user must tap "I understand" or equivalent before publishing.
- Info flags display as muted inline notes.
- `confidence` is a diagnostic number (0-1) stored in payload. It is not shown to the user directly but can be surfaced in admin/debug views.
- riskFlag codes (not raw messages) may be included in telemetry. Full flag text and user content must not be sent to telemetry (#126).

## needsHumanReview CTA / Status

When `/api/ai/post-preview` returns `needsHumanReview: true`:

| Stage | Behavior |
|---|---|
| Draft editing | CTA label changes to "提交审核"; a note explains the post will be reviewed before going public |
| After submit | Success message says "已提交审核，审核通过后会公开"; `status: "pending_review"` returned by backend |
| Detail/profile | User's own pending-review posts show a "待审核" badge, not "已发布" |

**Post-publish status flow:**

```
normal        -> published immediately
pending_review -> submitted, awaiting human review
hidden         -> hidden by moderation or user report
removed        -> removed by moderation
disputed       -> under dispute/appeal
```

The frontend must render distinct UI for each status on the user's own posts (detail view, profile history).

## AI Draft Save Lifecycle

### Save trigger

- `saveAiDraftSilently()` is called automatically after `requestAiPreview()` succeeds.
- It POSTs `currentAiPublishPayload()` to `/api/ai/post-drafts`.

### Payload

The draft payload includes: `imageUrls`, `title`, `body`, `tags`, `metadata`, `locationDraft`, `riskFlags`, `confidence`, `needsHumanReview`, `aiMode`, `aliasId`.

### Retention and deletion

| Event | Draft action |
|---|---|
| User publishes | Delete draft (backend clears on publish) |
| User cancels/closes | Keep draft for next session (backend retains ~7 days) |
| User clears form | Delete draft explicitly via API or on next save |
| 7 days elapsed | Backend auto-expires draft |

### Error handling

- **Current bug:** `saveAiDraftSilently()` swallows errors silently (`catch` only resets `draftSaving` state).
- **Contract:** Save failures must show a non-blocking inline status: "草稿未能保存，请注意不要关闭页面" (or similar). The user must not be told "草稿已自动保存" when the save failed.

### Privacy

- Drafts may contain image URLs, location, identity, and sensitive text. The draft API must require authentication.
- `aliasId` in the draft must not be replaced with a different alias on resume without user action.
- Precise `lat`/`lng` in the draft follows #132 location privacy policy.
- The draft payload must not include raw image EXIF data, GPS coordinates extracted from photos, or device metadata.

## Image Analysis: EXIF / GPS / Retention / Telemetry Scrub

### Upload chain

```
User selects file
  -> uploadImage(file, "ai-light-publish")
  -> POST /api/upload/image?purpose=ai-light-publish
  -> returns image URL
  -> URL sent to /api/ai/post-preview for AI analysis
```

### EXIF / GPS scrub

| Responsibility | Current state | Contract |
|---|---|---|
| Frontend | No stripping; raw `File` uploaded | Frontend must display a privacy notice before upload: "上传的图片将用于 AI 生成草稿。拍摄地点等元数据会被自动清理。" |
| Backend | Unknown/stripping not confirmed | Backend MUST strip EXIF, GPS, ICC profile, and device metadata from all uploaded images regardless of `purpose`. This applies to both `ai-light-publish` and `publish-v2`. |
| CDN/proxy | Unknown | CDN must not re-serve original with metadata. If CDN caches before stripping, backend must strip before CDN caches. |

**Test requirement:** Upload a JPEG with GPS EXIF data. The public image URL must contain no GPS metadata (verify with `exiftool` or equivalent).

### Purpose-based processing

| Purpose | Strip EXIF | Compress | Notes |
|---|---|---|---|
| `ai-light-publish` | Yes | Backend decision | Image also read by AI preview service |
| `publish-v2` | Yes | Backend decision | Standard publish |
| `avatar` | Yes (via canvas re-encode) | Client-side crop to 512x512 | Already handled in `ProfileEditorPanel.vue` |
| `map-asset` | Yes | Admin-only | Not user-facing |

### AI image retention

- Images uploaded with `purpose=ai-light-publish` are used for AI draft generation.
- After the draft is saved or the user cancels, the AI preview service must not retain the image beyond what is needed for the saved post.
- If the user cancels without publishing, the image URL and any AI-generated associations should be eligible for cleanup (implementation depends on backend garbage collection).

### Telemetry scrub

- Telemetry events from the AI publish flow must NOT include: image URLs, image filenames, GPS coordinates, post body text, post title, place names, or `aliasId`.
- Allowed in telemetry: flow step (upload/preview/publish), risk flag codes (not messages), confidence range (bucketed, not raw), error codes, `needsHumanReview` boolean, publish outcome (success/fail/pending).
- This aligns with #126 privacy-safe telemetry.

## Legacy vs Vue Payload

Both `currentAiPublishPayload()` (legacy) and `buildPublishPayload()` (Vue) produce a `PublishPayload`. Key differences:

| Field | Legacy AI | Vue Manual |
|---|---|---|
| `riskFlags` | From AI preview response | Always `[]` |
| `needsHumanReview` | From AI preview response | Always `false` |
| `confidence` | From AI preview response | From `locationDraft.confidence` |
| `aiMode` | From AI preview (`"ai-light-publish"`) | `"manual-vue"` or `"manual-vue-map-v2"` |
| `tag` | From parsed tags string | Single normalized tag |
| `identityTag` | Not in legacy payload | From user select |

**Contract:** Both paths must use the same `PublishPayload` type from `src/types/publish.ts`. The legacy flow should eventually migrate to Vue component or at minimum share the type definition. Until migration, field drift between the two builders must be monitored.

## Related Issues

- #138 - AI-assisted publish safety, draft, and review contracts (primary)
- #128 - Image upload privacy and media processing contracts
- #129 - Content moderation and user-safety interaction contracts
- #136 - Unsaved drafts and form input protection
- #127 - Auth session, CSRF, and rate-limit UX contracts
- #113 - Copy catalog (riskFlag copy, error messages)
- #126 - Privacy-safe telemetry
- #132 - Location privacy strategy
- #137 - Entity ID and API model normalize
