# Handoff: static-asset-base-path-contract

Date: 2026-05-10
Issue: #156

## Summary

Created a bounded docs-only contract slice defining the static asset base path contract for LIAN mobile web. The contract covers root versus subpath deployment modes, Vite `base` configuration and `LIAN_BASE_PATH` env variable, asset URL resolution for both the Vue and legacy runtimes, dual-runtime base-path alignment rules, PWA `scope` and `start_url` alignment with the base path, CDN and external asset interaction, reverse proxy contract, and verification checklists for both deployment modes.

## Files changed

| File | Change |
|---|---|
| `docs/frontend/static-asset-base-path-contract.md` | New. Authoritative contract for Vite base path, asset URL resolution, dual-runtime alignment, PWA scope, and subpath deployment rules |
| `docs/agent/handoffs/static-asset-base-path-contract.md` | New. This handoff |
| `docs/agent/tasks/issue-156-static-asset-base-path-contract.md` | New. Task record for this docs slice |

## Decisions made

1. **Two deployment modes** — `root` (default, `base: "/"`) and `subpath` (explicit `base: "/app/"` or similar). Root mode requires no configuration changes.
2. **`LIAN_BASE_PATH` env variable** — new env var read by `vite.config.ts` to set the Vite `base` field. Must start and end with `"/"`. Defaults to `"/"`.
3. **Vue runtime uses `import.meta.env.BASE_URL`** — all asset references in Vue source must use Vite's static import, `new URL()`, or `import.meta.env.BASE_URL`. Hardcoded root-relative paths are prohibited.
4. **Legacy runtime uses `window.LIAN_BASE_PATH`** — injected alongside existing `LIAN_API_BASE_URL` globals. The legacy HTML templates must prefix asset paths with this value.
5. **PWA scope/start_url must match base** — when PWA is implemented per #109, `scope` and `start_url` in the manifest must equal the `base` value. SW registration path must also be base-prefixed.
6. **External CDN unaffected** — Leaflet (unpkg) and Gaode tile URLs are absolute and do not interact with the `base` configuration.
7. **API proxy stays at origin root** — `/api/*` routes are not prefixed by `base`; the reverse proxy handles them independently.

## Validation

Intended validation from the task proposal:

```bash
npm run check
```

Manual validation completed in this pass:

- issue/task scope and allowed-file boundaries checked against the task proposal comment on issue #156
- cross-reference sanity checked against related issues #109, #134, #152, #167
- output restricted to the three allowed documentation paths
- contract format verified against existing contracts (appearance-theme-contract.md, http-client-contract.md)

Validation not completed in this environment:

- `npm run check` was not run because this is a docs-only change with no source or config modifications

## What was intentionally not done

- No `vite.config.ts` changes to add `base` field
- No `runtime-config.ts` changes to add `LIAN_BASE_PATH`
- No `scripts/serve-frontend-static-rehearsal.js` changes for base path injection
- No `public/index.html` changes for base-prefixed asset paths
- No PWA manifest, service worker, or icon changes
- No package, script, or CI changes
- No claim that issue #156 is fully complete

## Risks

- The contract will drift if `vite.config.ts` is modified to add `base` without referencing this document
- Legacy runtime subpath support requires non-trivial HTML template changes that may conflict with in-flight legacy work
- PWA scope rules are forward-looking (#109); if the PWA RFC changes its manifest strategy, this contract needs updating

## Rollback

Delete the three new docs files. No runtime behavior is affected.

## Next suggested task

Implement the `LIAN_BASE_PATH` env variable and `base` field in `vite.config.ts`, followed by `window.LIAN_BASE_PATH` injection in the static rehearsal server.
