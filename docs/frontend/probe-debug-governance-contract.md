# Probe, Debug UI, and Feature Flag Governance Contract

Issue: [#155](https://github.com/taoyu051818-sys/lian-mobile-web/issues/155) — Related to #155, Part of #155, Does not close #155
Scope: lifecycle governance for temporary probes, debug UI, feature flags, release diagnostics, and production cleanup.

---

## 1. Definitions

| Term | Meaning |
|---|---|
| **Probe** | A temporary UI surface or signal used to verify a build, deploy, or runtime condition. Probes are engineering-only by default. |
| **Debug UI** | Any user-facing surface (dialog, panel, badge, toast) added for engineering observation. Debug UI must not appear in production unless explicitly gated. |
| **Feature flag** | A runtime boolean or enum that controls product behavior. Feature flags have product owners and may ship to production. |
| **Experiment flag** | A feature flag tied to an A/B test or gradual rollout. Experiment flags have analytics owners and kill switches. |
| **Release diagnostics** | Non-user-visible signals (release ID, build manifest, health endpoint) used to verify deployment correctness. |
| **Production policy** | The rules governing what may be shown to real users in a production build. |

---

## 2. Probe / Flag Registry

Every probe, debug flag, feature flag, and experiment flag must be registered before merge. The registry is a single source of truth for lifecycle accountability.

### 2.1 Registry Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | yes | Unique identifier. Format: `camelCase` for code constants, `kebab-case` for storage keys. Must be globally unique across the project. |
| `type` | enum | yes | One of: `probe`, `debug-flag`, `feature-flag`, `experiment`. |
| `default` | `boolean \| string \| number` | yes | Default value when no runtime override is present. Probes default to `false` (off). |
| `env` | `string` | yes | Comma-separated allowlist of environments where the flag may be active. Values: `dev`, `staging`, `canary`, `production`. Probes must not list `production`. |
| `owner` | `string` | yes | GitHub handle of the engineer or team accountable for lifecycle. |
| `expiry` | `date` | yes | ISO-8601 date after which the flag/probe must be removed or promoted. Max 30 days from creation for probes; 90 days for flags. |
| `cleanupIssue` | `string` | yes | GitHub issue URL for removal work. Must exist before merge. |
| `storageKey` | `string` | no | localStorage key if the flag/probe persists client state. Must use `lian.` prefix and be listed in the storage registry. |
| `userVisibleImpact` | `string` | yes | Plain-language description of what a user sees when the flag is active. `"(none)"` for purely internal probes. |
| `productionPolicy` | enum | yes | One of: `never-show` (engineering-only, blocked in production), `gated` (requires explicit flag), `always-on` (promoted to permanent behavior). |

### 2.2 Registry Format

The registry lives in a future `src/platform/flagRegistry.ts`. Until then, entries are tracked in the PR that introduces them and documented in the relevant task doc.

```ts
interface FlagRegistryEntry {
  key: string;
  type: "probe" | "debug-flag" | "feature-flag" | "experiment";
  default: boolean | string | number;
  env: string;          // "dev,staging" or "dev,staging,canary,production"
  owner: string;        // GitHub handle
  expiry: string;       // ISO-8601 date
  cleanupIssue: string; // GitHub issue URL
  storageKey?: string;  // e.g. "lian.homeUpdateProbe.v1"
  userVisibleImpact: string;
  productionPolicy: "never-show" | "gated" | "always-on";
}
```

### 2.3 Naming Rules

| Context | Convention | Example |
|---|---|---|
| Code constant | `UPPER_SNAKE_CASE` | `HOME_UPDATE_PROBE_VERSION` |
| Registry key | `camelCase` | `homeUpdateProbe` |
| Storage key | `lian.<kebab-case>` | `lian.home-update-probe` |
| Feature flag key | `camelCase` | `enableDarkMode` |
| Experiment key | `camelCase` with `exp` prefix | `expFeedRankingV2` |

---

## 3. Production UI Rules

### 3.1 Engineering Probes Must Not Appear in Production

Production startup flow and user-visible UI must not show engineering probes by default.

| Rule | Enforcement |
|---|---|
| Probes with `productionPolicy: "never-show"` must be gated behind `import.meta.env.DEV` or an explicit environment check. | Code review + CI guard (see QA checklist §Q1). |
| Probe UI must not use user-facing copy patterns (toast, notification, banner) without a product copy entry in the i18n catalog. | Code review + lint (see §6). |
| Debug dialogs must not use `role="dialog" aria-modal="true"` unless they go through the unified overlay primitive. Direct `z-index` and `position: fixed` are not permitted for debug surfaces. | Code review. |

### 3.2 User-Visible Release Notes vs. Engineering Probes

| Intent | Mechanism | Example |
|---|---|---|
| "Tell engineering the build landed" | Release diagnostics (§5) | Build manifest, health endpoint |
| "Tell users about new features" | Product release note in i18n catalog | Update modal with product copy |
| "Verify a specific code path ran" | Probe with `never-show` production policy | Console debug log, dev-only panel |

Engineering probes must never be the vehicle for user-facing release notes. If a release note is needed, create a product update flow with proper copy.

---

## 4. localStorage Cleanup

### 4.1 Storage Key Registration

Every `lian.*` localStorage key used by probes, flags, or debug UI must be registered in the storage registry (see #106). Registration includes:

- Key name and prefix.
- TTL or expiry behavior.
- Cleanup triggers: logout, account deletion, "clear local data" action.

### 4.2 Probe Key Lifecycle

| Phase | Behavior |
|---|---|
| **Active** | Key is written and read by the probe. TTL is enforced by the probe itself. |
| **Expired** | Key is no longer read. On next app launch, expired probe keys are removed from localStorage. |
| **Removed** | The probe's cleanup issue is closed. The key is no longer written. Any remaining instances are cleaned by the storage registry sweep. |

### 4.3 Cleanup Triggers

All probe and debug localStorage keys are cleared on:

1. **Logout**: `lian.*Probe*` and `lian.*debug*` keys are removed.
2. **Account deletion**: Same scope as logout.
3. **"Clear local data" action**: Same scope as logout, plus feature flag overrides.
4. **App version upgrade**: Expired probe keys (past `expiry` date) are swept on first launch of a new version.

### 4.4 Key Proliferation Guard

No single probe may create more than one localStorage key. Versioned probe keys (e.g., `lian.homeUpdateProbe.v1`, `lian.homeUpdateProbe.v2`) are prohibited. Use a single key and store the version in the value.

---

## 5. Release Diagnostics

Release diagnostics verify deployment correctness without involving real users.

### 5.1 Mechanisms

| Mechanism | Visibility | Purpose |
|---|---|---|
| `releaseId` / `buildId` | Dev-only diagnostics panel | Verify which build is running |
| Health endpoint | Internal / monitoring | Post-deploy smoke check |
| Build manifest | CI artifact | Map build to commit |
| Dev diagnostics panel | Dev-only (`import.meta.env.DEV`) | Show release ID, active flags, probe state |

### 5.2 What Must Not Be Used for Release Diagnostics

- User-visible dialogs, toasts, or banners.
- localStorage probes visible to end users.
- Console output in production builds (see §6).
- Any surface that requires user interaction to dismiss.

### 5.3 Post-Deploy Smoke

The release runbook (`docs/frontend/release-runbook.md`) must include a step that verifies the deployed `releaseId` matches the expected build. This replaces the need for user-visible probe dialogs.

---

## 6. Console / Logging Policy

### 6.1 Production Console Rules

| Level | Production Policy |
|---|---|
| `console.log` | **Forbidden**. No new `console.log` in any file. Existing instances must be migrated to the logger wrapper or removed. |
| `console.debug` | **Forbidden** in production. Allowed behind `import.meta.env.DEV`. |
| `console.warn` | **Allowed** through the logger wrapper only. Must not contain PII. |
| `console.error` | **Allowed** through the logger wrapper only. Must not contain PII. Used for runtime error boundary diagnostics. |

### 6.2 Logger Wrapper

All console output must go through a logger wrapper (future `src/platform/logger.ts`). The wrapper:

- Strips output in production builds (tree-shaken or gated).
- Redacts PII fields before logging.
- Provides `debug`, `info`, `warn`, `error` levels.
- Level is controlled by runtime config, not hardcoded.

### 6.3 Sensitive Data

Console and logger output must never contain:

- Post content, message text, profile bios.
- Image URLs, CDN paths.
- Client ID, user ID, alias ID.
- Email, username.
- GPS coordinates, precise location.
- Auth tokens, cookie values.
- Invite codes.

---

## 7. Engineering Wording Guard

User-visible text (UI copy, toast messages, notification content) must not contain engineering terminology.

### 7.1 Forbidden Terms in Production Copy

| Term | Context |
|---|---|
| `probe` | Internal verification concept |
| `canary` | Deployment channel name |
| `debug` | Engineering tooling term |
| `staging` | Environment name |
| `main` (as branch reference) | Git workflow term |
| `build` (as in "this build") | Engineering release marker |
| `commit`, `deploy` | DevOps terms |
| `flag`, `experiment` | Internal feature management terms |
| `版本标记` (version marker) | Engineering probe copy |

### 7.2 Exception

These terms are permitted only when:

- The surface is gated behind `import.meta.env.DEV`.
- The surface is explicitly marked as engineering-only (e.g., dev diagnostics panel).

---

## 8. Overlay and Accessibility for Debug UI

Debug and probe UI surfaces must follow the same overlay and a11y contracts as production UI, or must not enter production.

| Rule | Rationale |
|---|---|
| Debug dialogs must use the unified overlay primitive (`Sheet`, `OverlayManager`). | Prevents z-index conflicts with bottom chrome, detail panel, toast, and sheet. |
| Debug dialogs must not set raw `z-index` or `position: fixed` directly. | Magic numbers create stacking context bugs. |
| Debug dialogs behind `import.meta.env.DEV` may relax a11y requirements (focus trap, Escape-to-close) but must not be keyboard-trapping or confusing. | Dev tools have lower a11y bar but must not create anti-patterns. |
| Debug dialogs in production must fully comply with the a11y contract: `role="dialog"`, `aria-modal`, focus trap, Escape, scroll lock, focus return. | If it reaches users, it must be accessible. |

---

## 9. Relationship to Other Issues

| Issue | Intersection |
|---|---|
| #106 | Storage registry. All probe/debug `lian.*` keys must be registered. |
| #113 | Copy catalog. Engineering copy must not leak into user-facing surfaces. |
| #119 | Runtime config / feature flag contract. Flag registry extends runtime config. |
| #124 | Static quality gates. CI guard for expired flags, bare console, engineering wording. |
| #126 | Observability / release diagnostics. Release ID replaces probe dialogs. |
| #133 | Testing strategy. QA guard checklist for probe/flag lifecycle. |
| #134 | Release runbook. Post-deploy smoke replaces user-visible probes. |
| #135 | Overlay layer / focus stack. Debug UI overlay rules. |
| #147 | Accessibility. Debug UI a11y requirements. |
| #149 | Client ID / privacy. Probe storage key cleanup on account deletion. |
| #153 | Localization / copy resource. Engineering copy guard. |
| #154 | HTTP client diagnostics. Logger wrapper alignment. |

---

## 10. Out of Scope

- **Backend feature flags or server-side experiments**: this contract covers frontend only.
- **Analytics event routing**: tracked in #126 and #141.
- **PWA service worker probes**: tracked in #109 and #134.
- **Dark mode, responsive layout flags**: tracked separately when those features enter development.
- **CI implementation details**: the contract defines what CI must guard; the implementation is in #124.

---

## 11. Non-Goals

This contract does not:

- Define product feature flag strategy (when to ship, how to roll out).
- Replace the release runbook for deployment procedures.
- Govern backend observability or server-side logging.
- Create the runtime logger or flag registry implementation (those are follow-up engineering tasks).
