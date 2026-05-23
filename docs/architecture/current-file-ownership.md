# Current File Ownership

This document used to be a manually maintained per-file table. It drifted whenever files were added, renamed, or deleted, and frequently disagreed with the code.

The file table is now auto-generated locally on demand. See:

- **`docs/architecture/auto/file-ownership.md`** — every `src/` file with a one-line summary and line count, regenerated from source by `npm run ownership-doc`. The file is **not tracked in git** (it lives in `.gitignore`); regenerate it locally whenever you want the latest snapshot.
- `npm run check:ownership-doc` regenerates the file and then re-runs the generator in `--check` mode, so CI catches any nondeterminism in the generator without ever needing the artifact in the index. There is no PR-side workflow that writes back to your branch.

## How this stays truthful

- `package.json` exposes `npm run ownership-doc` for regeneration and `npm run check:ownership-doc` for the regenerate-then-verify-determinism check that runs as part of `npm run check`.
- `npm run check` exercises that ownership-doc check together with `scripts/validate-project-structure.js`; broken boundary rules and nondeterministic generator output both fail the lane.
- `scripts/generate-ownership-doc.js` owns the generated snapshot, while `scripts/validate-project-structure.js` owns the layer and barrel rules that the ownership docs describe.
- `vite.config.ts` does not generate ownership data, but it is part of the same runtime-sensitive root contract surface. When root runtime/config behavior changes, this ownership guide may need a refresh so the repo story stays coherent.

## High-level rules

```text
index.html
  -> src/main.ts
  -> src/App.vue
  -> src/shell/AppShell.vue
  -> src/app/AppViewHost.vue
  -> src/features/<active-view>/*
```

- `src/app/` owns view registry and active-view switching.
- `src/shell/` owns persistent chrome (top/bottom regions, detail sheet) and chrome state.
- `src/features/<domain>/` owns one user-facing surface end-to-end. Each feature exports its public surface through `index.ts`; cross-feature imports must go through that barrel.
- `src/ui/` owns presentational primitives. It must not import from `src/features/`.
- `src/domain/` owns pure business logic — no Vue, API, UI, or feature imports.
- `src/platform/` owns adapters (storage, network helpers). It must not import from features or pages.
- `src/api/` owns HTTP and request/response normalization.
- `src/config/brand/` owns user-facing strings, grouped by domain.
- `src/types/` owns shared TypeScript types.

## Boundary enforcement

`scripts/validate-project-structure.js` enforces the rules above. Run it via `npm run check`:

- `src/views/` is forbidden (legacy directory; views are migrated to `src/features/`).
- `src/ui/**` cannot import from `src/features/**`.
- `src/domain/**` is pure (no Vue, API, UI, or feature imports).
- `src/platform/**` cannot import feature/page components.
- Every feature directory must have `index.ts`. Cross-feature imports must hit the barrel or a re-exported symbol; deep imports into a sibling feature are rejected.

## Adding a feature

1. Create `src/features/<name>/` with the feature's components, composables, and styles.
2. Create `src/features/<name>/index.ts` declaring the feature's public surface (typically the entry View component plus any cross-feature composables).
3. Wire the entry View into `src/app/AppViewHost.vue` if it is a top-level tab.
4. If the feature owns user-facing strings, add them to `src/config/brand/<name>.ts` and re-export from `src/config/brand/index.ts`.
