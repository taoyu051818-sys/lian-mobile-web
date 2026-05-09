# Localization and Locale Contract — LIAN Mobile Web

Date: 2026-05-10
Status: Draft — docs-only contract slice for #153

Related to #153.
Part of #153.
Does not close #153.

## Scope

This contract defines the frontend localization model for the Vue canary shell. It covers the zh-CN-first language policy, locale resolution order, metadata and document-title language rules, formatter responsibilities, copy-resource structure, validation error contracts, map/place provider language alignment, PWA metadata localization, accessibility copy policy, and a migration checklist.

This document is a planning/implementation contract only. It does not change runtime Vue components, i18n libraries, scripts, package configuration, or CI.

## zh-CN-first policy

LIAN is a Chinese campus product. The current and default language is `zh-CN`. All user-facing copy, metadata, formatting, and accessibility text must be authored in Simplified Chinese as the primary source of truth.

| Principle | Rule |
|---|---|
| Default locale | `zh-CN` is the only required locale for MVP |
| Source language | All copy keys default to zh-CN values; zh-CN is the source catalog |
| English scope | English (`en-US`) is a future locale, not an MVP deliverable |
| Hardcoded Chinese | Existing hardcoded Chinese strings are acceptable during migration but must be progressively replaced with copy-key lookups |
| Mixed-language UI | Product UI must not mix English engineering labels with Chinese user copy (e.g., `LIAN Vue Shell` as page title) |

Contract rule: do not introduce locale switching, language picker UI, or multi-locale runtime until zh-CN copy-key migration is complete and an en-US catalog is explicitly approved.

## Locale resolution order

When locale switching is eventually supported, resolution must follow this priority chain:

| Priority | Source | Storage | Scope |
|---|---|---|---|
| 1 (highest) | URL parameter or route prefix | URL | Per-navigation |
| 2 | Account preference | Server-side user profile | Per-account, cross-device |
| 3 | Local client preference | `localStorage` key `lian.locale` | Per-device, per-browser |
| 4 | Browser language | `navigator.languages` / `navigator.language` | Browser-level |
| 5 (lowest) | Application default | Hardcoded `zh-CN` | Global fallback |

Rules:

- MVP behavior: skip priorities 1-3, resolve directly to `zh-CN` (priority 5). URL, account, and client locale storage are not implemented in this slice.
- Future implementation: each priority level must be explicitly skipped if absent, not defaulted to `null` ambiguously.
- `lian.locale` storage key must be registered in the storage registry (#106) when implemented.
- Locale changes must propagate via `storage` event for cross-tab sync (#120).
- The resolved locale must be reflected in `<html lang="...">` dynamically once switching is supported.

## Metadata and document-title language policy

### Current state

- `<html lang="zh-CN">` — correct for the default locale.
- `<title>LIAN Vue Shell</title>` — engineering label, not a product title.

### Contract rules

| Element | Rule | MVP target |
|---|---|---|
| `<html lang>` | Must match the resolved locale | `zh-CN` (static) |
| `<title>` | Must be a product-quality title in the resolved locale | `LIAN — 校园社区` or equivalent zh-CN product title |
| Per-view title | Each route/view should set `document.title` via a composable or router hook | `{view name} — LIAN` format in zh-CN |
| Meta description | Must be zh-CN product copy, not engineering placeholder | Define in metadata registry |
| OG title/description | Must match the locale of the page content | Same as document title / meta description |
| PWA `manifest.name` | Must be the zh-CN product name | `LIAN` or `LIAN 校园社区` |
| PWA `manifest.short_name` | Must be a zh-CN-friendly short name | `LIAN` |
| PWA `manifest.description` | Must be zh-CN product description | Define in metadata registry |
| PWA `manifest.lang` | Must match the default locale | `zh-CN` |

Contract rule: no view may display an engineering placeholder (e.g., `LIAN Vue Shell`) as its title in any user-visible surface including browser tab, PWA title bar, social preview, or screen reader announcement.

### Metadata registry (future)

Implementation should define a typed metadata registry mapping route names to:

```ts
interface ViewMetadata {
  title: string        // zh-CN document title
  description: string  // zh-CN meta description
  ogTitle?: string     // defaults to title
  ogDescription?: string // defaults to description
}
```

This registry is a future implementation concern. The contract requires that such a registry exist before router integration ships.

## Formatter responsibilities

All locale-sensitive formatting must go through a dedicated formatter layer, not inline component logic.

### Required formatters

| Formatter | Input | Output | Notes |
|---|---|---|---|
| `formatRelativeTime` | `Date` or timestamp | `刚刚`, `X分钟前`, `X小时前`, `昨天`, `X天前` | Must use `Intl.RelativeTimeFormat` with zh-CN fallback |
| `formatAbsoluteDate` | `Date` | `M月D日`, `YYYY年M月D日` | Must use `Intl.DateTimeFormat` with zh-CN options |
| `formatCount` | number + unit key | `3条评论`, `12个赞` | Must handle pluralization rules per locale |
| `formatImageCount` | current / total | `已准备 3/9 张图片` | Unit string must come from copy key |
| `formatCharacterCount` | current / max | `38/40 字` | Clarify counting unit: grapheme clusters, not UTF-16 code units |
| `formatMaxLength` | max + unit | `标题最多 40 个字` | Unit string must come from copy key |
| `formatFileSize` | bytes | `1.2 MB`, `340 KB` | Use `Intl.NumberFormat` with locale-aware units |

### Formatter contract rules

1. Formatters must be pure functions or composables with no direct DOM access.
2. Formatters must accept the resolved locale as an explicit parameter or derive it from a locale context.
3. Formatters must use `Intl.*` APIs where available, with zh-CN string fallbacks for unsupported environments.
4. Components must not inline-format dates, counts, or units in templates; they must call the formatter layer.
5. The "character" in character limits refers to Unicode grapheme clusters, not code points or UTF-16 code units. Implementation must use `Intl.Segmenter` or equivalent.
6. Backend-returned counts (e.g., comment count, like count) must be formatted client-side, not displayed as raw numbers.

### Time formatting detail

The current `src/utils/time.ts` contains hardcoded Chinese relative time strings. The contract requires:

- Extract all locale strings into the copy-resource layer.
- Replace inline Chinese formatting with `Intl.RelativeTimeFormat` calls.
- Preserve the existing behavior (just now, minutes ago, hours ago, yesterday, days ago, absolute date after threshold) as the zh-CN output contract.
- The threshold between relative and absolute display remains a formatter config concern, not a locale concern.

## Copy-resource structure

### Directory layout

```
src/i18n/
  index.ts              # locale resolution, getLocale(), t() function
  types.ts              # CopyKey type definition, catalog shape
  messages/
    zh-CN.ts            # default and only MVP catalog
    # en-US.ts          # future: not created in this slice
  formatters/
    time.ts             # formatRelativeTime, formatAbsoluteDate
    count.ts            # formatCount, formatImageCount, formatCharacterCount
    number.ts           # formatFileSize, formatMaxLength
  metadata/
    views.ts            # per-view title/description registry (future)
```

### Catalog shape

```ts
// types.ts
type CopyKey = keyof typeof import('./messages/zh-CN').default

interface CopyCatalog {
  [key: string]: string | CopyCatalog
}
```

### Key namespace convention

Copy keys must be organized by domain, using dot-separated paths:

| Namespace | Purpose | Examples |
|---|---|---|
| `common.*` | Shared UI elements | `common.submit`, `common.cancel`, `common.loading` |
| `nav.*` | Navigation labels | `nav.home`, `nav.feed`, `nav.map`, `nav.profile` |
| `feed.*` | Feed view copy | `feed.loading`, `feed.loadMore`, `feed.empty` |
| `auth.*` | Authentication flow | `auth.login`, `auth.register`, `auth.emailPlaceholder` |
| `publish.*` | Publish flow | `publish.titlePlaceholder`, `publish.maxTitleLength` |
| `detail.*` | Post detail | `detail.reply`, `detail.share`, `detail.report` |
| `profile.*` | Profile view | `profile.viewHistory`, `profile.favorites` |
| `map.*` | Map view | `map.explore`, `map.campusMap` |
| `messages.*` | Messages view | `messages.title`, `messages.empty` |
| `error.*` | Error states | `error.network`, `error.uploadFailed`, `error.generic` |
| `toast.*` | Toast notifications | `toast.linkCopied`, `toast.published` |
| `validation.*` | Form validation | `validation.titleRequired`, `validation.passwordTooShort` |
| `a11y.*` | Accessibility labels | `a11y.mainNav`, `a11y.mainContent` |
| `time.*` | Time formatter strings | `time.justNow`, `time.minutesAgo`, `time.hoursAgo` |
| `count.*` | Count unit strings | `count.comments`, `count.likes`, `count.images` |

### Migration strategy

1. **Phase 0 (current):** All copy is hardcoded in components. No copy keys exist.
2. **Phase 1 (this contract enables):** Create `src/i18n/` directory structure and `zh-CN.ts` catalog. Migrate copy from components to catalog incrementally, starting with high-traffic views.
3. **Phase 2:** Replace inline formatting with formatter layer. Wire `t()` calls into all user-facing strings.
4. **Phase 3:** Complete migration of all ~29 affected source files. Add lint guard against new hardcoded Chinese strings.
5. **Phase 4 (future):** Introduce `en-US.ts` catalog. Enable locale switching. Update `html lang` dynamically.

Contract rule: each migration phase is a separate implementation PR. This contract does not implement any phase.

## Validation error contract

### Current state

Validation functions in `PublishView.vue` and `AuthPanel.vue` return Chinese strings directly (e.g., `"请填写标题"`, `"密码至少需要 8 位"`).

### Contract rules

| Rule | Description |
|---|---|
| Structured errors | Validation must return `{ key: CopyKey, params?: Record<string, string | number> }` instead of raw Chinese strings |
| Copy-key rendering | The UI layer renders the error message by looking up the key in the current locale's catalog |
| Backend errors | Backend validation errors that reach the frontend must be mapped to copy keys where possible; unmapped errors fall back to `error.generic` |
| Parameterized messages | Errors with dynamic values (e.g., "at least 8 characters") must use template parameters, not string concatenation |

Example contract:

```ts
// Instead of:
return '密码至少需要 8 位'

// Return:
return { key: 'validation.passwordMinLength', params: { min: 8 } }

// zh-CN catalog:
'validation.passwordMinLength': '密码至少需要 {min} 位'
```

## Map and place provider language contract

### Current state

- Gaode tile URL hardcodes `lang=zh_cn`.
- Map UI mixes Chinese and English: `LIAN Campus Map`, `探索校园正在发生什么`.
- Place names, types, and status labels are hardcoded.

### Contract rules

| Rule | Description |
|---|---|
| Tile language | Map provider tile language parameter must derive from the resolved UI locale, not be hardcoded |
| Map title | Map view title must use product copy from the catalog, not a mixed-language engineering label |
| Place labels | Place type, status, and category labels must come from copy keys |
| Provider registry | The map provider registry (#132) must declare supported tile languages |
| AI summary language | AI-generated place summaries must be tagged with their language or returned per-locale by the backend |

Contract rule: map tile language, UI labels, and place metadata must be consistent with the resolved UI locale. Mixed-language map surfaces are not acceptable.

## PWA metadata localization

### Contract rules

| Element | zh-CN MVP value | Future multi-locale behavior |
|---|---|---|
| `manifest.name` | `LIAN 校园社区` | Per-locale manifest or dynamic generation |
| `manifest.short_name` | `LIAN` | Same across locales |
| `manifest.description` | zh-CN product description | Per-locale description |
| `manifest.lang` | `zh-CN` | Follows resolved locale |
| Install prompt | zh-CN copy | Localized copy |
| Offline page | zh-CN copy | Localized copy |
| Update prompt | zh-CN copy | Localized copy |

The MVP ships a single manifest with zh-CN values. Per-locale manifests or dynamic manifest generation is a future concern.

## Accessibility copy policy

| Rule | Description |
|---|---|
| `aria-label` values | Must use copy keys, not hardcoded Chinese strings |
| Screen reader announcements | View title changes, toast announcements, and live-region updates must use the copy catalog |
| Locale-aware formatting | Screen reader text that includes numbers, dates, or counts must use the formatter layer, not raw values |
| Mixed-language avoidance | `aria-label` must not mix Chinese and English in a single label |

## Cross-issue boundary

| Issue | Relationship |
|---|---|
| #113 | Copy catalog consistency. This contract defines the resource structure; #113 governs editorial consistency within it |
| #117 | SEO / OG metadata. This contract defines the language policy for metadata; #117 defines the metadata fields |
| #118 | Timestamp formatter. This contract defines the formatter layer; #118 defines the specific time display contract |
| #133 | Testing strategy. Formatter tests and copy-key coverage are governed by #133 |
| #147 | Accessibility. This contract defines a11y copy policy; #147 defines broader a11y requirements |
| #150 | Appearance / theme. Orthogonal. Locale does not affect theme tokens |
| #106 | Storage registry. `lian.locale` key must be registered when locale switching is implemented |
| #120 | Cross-tab sync. Locale changes must propagate via storage events |
| #132 | Map provider contract. Tile language parameter must derive from locale |
| #146 | Place sheet contract. Place labels must come from copy keys |

## Verification checklist

- [ ] `<html lang>` matches the resolved locale (zh-CN for MVP)
- [ ] `<title>` is a product-quality zh-CN title, not an engineering placeholder
- [ ] Per-view `document.title` uses the metadata registry
- [ ] All user-facing strings reference copy keys in `zh-CN.ts`
- [ ] Date/time/count/unit formatting goes through the formatter layer
- [ ] Validation errors return structured `{ key, params }` objects
- [ ] Map tile language derives from the resolved locale
- [ ] PWA manifest uses zh-CN values
- [ ] `aria-label` values use copy keys
- [ ] No new hardcoded Chinese strings are introduced (lint guard)
- [ ] Formatter unit tests cover zh-CN output for all formatters

## What this contract does not do

- Does not install an i18n library (e.g., `vue-i18n`, `i18next`)
- Does not create `src/i18n/` files or copy catalogs
- Does not migrate any hardcoded Chinese strings
- Does not implement locale switching or language picker UI
- Does not implement per-view document title or router meta hooks
- Does not change the PWA manifest
- Does not modify map tile provider parameters
- Does not add formatter functions or tests
- Does not close #153
