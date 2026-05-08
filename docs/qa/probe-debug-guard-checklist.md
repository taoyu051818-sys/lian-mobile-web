# Probe / Debug / Flag — QA Guard Checklist

Issue: [#155](https://github.com/taoyu051818-sys/lian-mobile-web/issues/155) — Related to #155, Part of #155, Does not close #155
Contract: `docs/frontend/probe-debug-governance-contract.md`

Minimal guard checklist for verifying that temporary probes, debug UI, feature flags, and release diagnostics do not leak into production. Each item maps to a contract section.

---

## Q1 — Expired Probe / Flag Detection (Contract §2)

- [ ] **Q1a.** Grep for all `FlagRegistryEntry` definitions (or equivalent constants). Verify every entry has an `expiry` date.
- [ ] **Q1b.** Verify no entry has an `expiry` in the past. If any do, flag them for removal or extension.
- [ ] **Q1c.** Verify every entry has a `cleanupIssue` URL that resolves to an open GitHub issue.
- [ ] **Q1d.** Verify every probe-type entry has `productionPolicy: "never-show"`.

## Q2 — Engineering Wording in User-Facing Copy (Contract §7)

- [ ] **Q2a.** Grep user-visible UI files (`.vue`, `.ts` in `src/views/`, `src/components/`) for the following terms in template strings, `textContent`, or i18n calls:
  - `probe`, `canary`, `debug`, `staging`, `main` (branch reference), `build` (release marker), `commit`, `deploy`, `flag`, `experiment`, `版本标记`, `更新验证`
- [ ] **Q2b.** Verify any matches are either:
  - Behind `import.meta.env.DEV` (dev-only), or
  - Present in the i18n copy catalog with a product-appropriate translation.
- [ ] **Q2c.** Verify no engineering term appears in a `role="dialog"` surface accessible to production users.

## Q3 — Bare Console Logging (Contract §6)

- [ ] **Q3a.** Grep for bare `console.log(` across `src/`. Verify zero matches (excluding test files and `node_modules`).
- [ ] **Q3b.** Grep for bare `console.debug(` in `src/`. Verify all matches are behind `import.meta.env.DEV`.
- [ ] **Q3c.** Grep for `console.warn(` and `console.error(` in `src/`. Verify all go through the logger wrapper or are in the error boundary handler.
- [ ] **Q3d.** Verify no `console.*` call in `src/` contains PII-shaped strings: email patterns, UUID patterns, GPS coordinate patterns, `Bearer `, `token=`.

## Q4 — Production-Visible Debug UI (Contract §3)

- [ ] **Q4a.** Grep for `probe`, `debug`, `diag` in component filenames and route definitions. Verify no probe/debug component is rendered without an environment gate.
- [ ] **Q4b.** Build for production (`npm run build`). Open the production bundle. Verify:
  - No probe dialog appears on app startup.
  - No "更新验证" or engineering copy is visible.
  - No debug panel or badge is visible.
- [ ] **Q4c.** Inspect the production bundle source (or source maps). Verify probe code paths are tree-shaken or gated behind `import.meta.env.DEV`.

## Q5 — localStorage Key Hygiene (Contract §4)

- [ ] **Q5a.** Open browser DevTools → Application → Local Storage. Grep all `lian.*` keys. Verify every key with `Probe`, `debug`, or `flag` in its name is registered in the storage registry.
- [ ] **Q5b.** Simulate a version upgrade: change the probe version constant. Verify old probe keys are cleaned up on next launch.
- [ ] **Q5c.** Trigger "clear local data" or logout. Verify all `lian.*Probe*` and `lian.*debug*` keys are removed.
- [ ] **Q5d.** Verify no probe creates multiple versioned localStorage keys (e.g., `lian.foo.v1`, `lian.foo.v2`).

## Q6 — Release Diagnostics (Contract §5)

- [ ] **Q6a.** Verify a `releaseId` or `buildId` is available at runtime (injectable via build config or runtime fetch).
- [ ] **Q6b.** Verify the dev diagnostics panel (if it exists) shows the current `releaseId`.
- [ ] **Q6c.** Verify no user-visible dialog or toast is used to display release/build information.
- [ ] **Q6d.** Verify the post-deploy smoke step in `docs/frontend/release-runbook.md` checks the deployed `releaseId`.

## Q7 — Overlay and Accessibility for Debug Surfaces (Contract §8)

- [ ] **Q7a.** Verify no debug/probe surface sets raw `z-index` or `position: fixed` directly. All overlays must go through the unified overlay primitive.
- [ ] **Q7b.** If a debug surface is production-visible (gated, not `never-show`), verify it has:
  - `role="dialog"` and `aria-modal="true"`
  - Focus trap
  - Escape-to-close
  - Scroll lock
  - Focus return on close
- [ ] **Q7c.** Verify no debug surface has a higher z-index than production overlays (toast, sheet, detail panel).

## Q8 — Registry Completeness (Contract §2.1)

- [ ] **Q8a.** For every probe, debug flag, feature flag, or experiment constant found in `src/`, verify a registry entry exists with all required fields: `key`, `type`, `default`, `env`, `owner`, `expiry`, `cleanupIssue`, `userVisibleImpact`, `productionPolicy`.
- [ ] **Q8b.** Verify no entry has `env` including `production` when `type` is `probe`.
- [ ] **Q8c.** Verify the `owner` field references a real GitHub handle.

---

## Running This Checklist

1. **Static scan (Q1–Q3, Q8):** Run grep/ripgrep commands against `src/`. Can be automated in CI.
2. **Production build (Q4):** `npm run build` then serve the dist. Open in a clean browser profile (no localStorage carryover).
3. **Storage inspection (Q5):** Use Chrome DevTools Application tab. Manually trigger logout/clear-data flows.
4. **Release diagnostics (Q6):** Check build config output and `docs/frontend/release-runbook.md`.
5. **Overlay audit (Q7):** Code review. Use DevTools Elements panel to inspect z-index and positioning of debug surfaces.

## CI Integration Notes

Items Q1b, Q1d, Q3a, Q3b, Q4a, and Q8a are suitable for automated CI guards. The grep patterns can be added to `npm run check` or a dedicated `npm run guard:probes` script. Items requiring manual inspection (Q4b, Q5, Q7) should be on the release checklist.

---

## Not Covered Here

- Backend feature flags or server-side experiments.
- Analytics event routing (see #126, #141).
- PWA service worker probes (see #109, #134).
- Product feature flag rollout strategy.
- Logger wrapper implementation (see #126).
