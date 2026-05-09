# Handoff: localization-locale-contract

Date: 2026-05-10
Issue: #153

## Summary

Created a bounded docs-only contract slice defining the LIAN mobile web localization model for zh-CN-first development, locale resolution, metadata language policy, formatter responsibilities, copy-resource structure, validation error contracts, map/place provider language alignment, PWA metadata localization, and accessibility copy policy.

## Files changed

| File | Change |
|---|---|
| `docs/frontend/localization-locale-contract.md` | New. Authoritative localization/locale contract for zh-CN policy, locale resolution, metadata, formatters, copy structure, validation, map, PWA, and a11y rules |
| `docs/agent/handoffs/localization-locale-contract.md` | New. This handoff |
| `docs/agent/tasks/issue-153-localization-locale-contract.md` | New. Task record for this docs slice |

## Decisions made

1. **zh-CN-first policy** — `zh-CN` is the only required MVP locale. English (`en-US`) is a future locale, not an MVP deliverable. No locale switching or language picker until zh-CN migration is complete.
2. **Locale resolution order** — URL > account preference > client localStorage (`lian.locale`) > browser language > application default (`zh-CN`). MVP skips to application default.
3. **Metadata language policy** — `<title>` must be a product-quality zh-CN title, not the engineering placeholder `LIAN Vue Shell`. Per-view titles, OG metadata, and PWA manifest must all be zh-CN.
4. **Formatter layer** — All locale-sensitive formatting (relative time, absolute date, counts, character limits, file sizes) must go through a dedicated formatter layer using `Intl.*` APIs, not inline component logic.
5. **Copy-resource structure** — `src/i18n/messages/zh-CN.ts` as the source catalog with dot-separated key namespaces by domain (`feed.*`, `auth.*`, `error.*`, etc.). Typed `CopyKey` type for compile-time safety.
6. **Validation error contract** — Validation must return structured `{ key, params }` objects instead of raw Chinese strings. The UI renders messages by looking up keys in the locale catalog.
7. **Map provider language** — Tile language parameter must derive from the resolved UI locale, not be hardcoded. Place labels and map titles must use copy keys.
8. **Character counting** — Character limits refer to Unicode grapheme clusters, not UTF-16 code units.

## Validation

Intended validation from the task proposal:

```bash
npm run check
```

Manual validation completed in this pass:

- issue/task scope and allowed-file boundaries checked against the task proposal comment on issue #153
- cross-reference sanity checked against related issues #106, #113, #117, #118, #120, #123, #132, #133, #140, #146, #147, #150
- output restricted to the three allowed documentation paths
- contract structure follows the same pattern as responsive-layout-contract (#144) and appearance-theme-contract (#150)

Validation not completed in this environment:

- `npm run check` was not run because the change is docs-only and does not affect TypeScript compilation or source files

## What was intentionally not done

- No `src/**`, `public/**`, or i18n library installation
- No copy catalog creation or hardcoded string migration
- No formatter implementation or `Intl.*` wrapper code
- No locale switching, language picker, or router meta hooks
- No PWA manifest changes
- No map tile provider parameter changes
- No package, script, or CI changes
- No claim that issue #153 is fully complete

## Risks

- The contract will drift if follow-up PRs implementing copy keys or formatters do not cite this document
- The `src/i18n/` directory structure may need adjustment once a specific i18n library (e.g., vue-i18n) is chosen
- The validation error structured-key contract depends on backend error format alignment that has not been negotiated
- Grapheme cluster counting via `Intl.Segmenter` may not be available in all target browsers; fallback strategy needed

## Rollback

Delete the three new docs files. No runtime behavior is affected.

## Next suggested task

Implement the `src/i18n/` directory skeleton with `zh-CN.ts` catalog, typed `CopyKey`, and `t()` composable. Migrate copy from one high-traffic view (e.g., `FeedView.vue`) as a proof-of-concept.
