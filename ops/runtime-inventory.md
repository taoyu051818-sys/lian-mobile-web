# Runtime inventory

## Dependency preflight contract

The frontend runtime supervisor (`scripts/serve-frontend-runtimes.js`) must not install dependencies at startup.

When the Vite binary is missing the supervisor must:

1. Log the missing binary path.
2. Log a deployment guidance message referencing `npm ci` or a verified artifact.
3. Exit with a non-zero status.

This keeps production startup deterministic and aligns runtime behavior with the CI artifact / lockfile supply-chain baseline (#134, #125).

## Windows spawn compatibility

When spawning a `.cmd` shim on Windows (for example the Vite binary) the supervisor must pass `shell: true` so `cmd.exe` resolves the shim correctly. This flag is limited to `.cmd` paths; Unix process startup remains unchanged.

## Runtime config accessor contract

The shared runtime config accessor (`src/config/runtime-config.ts`) reads `window.LIAN_API_BASE_URL` and `window.LIAN_IMAGE_PROXY_BASE_URL` lazily on every call. The static rehearsal server and Vite dev-server config both validate env vars at startup via an inline `parseEnvUrl` helper that rejects non-absolute URLs. Outside dev contexts the accessor rejects localhost origins and requires the image-proxy URL to be non-empty.

This keeps the injection order contract explicit: the serve script injects config into `<head>` before any app module runs, and the accessor never freezes a stale value at import time.

## Unsafe DOM sink guard

The frontend verification gate includes `scripts/guard-unsafe-dom-sinks.js` to block newly introduced raw `v-html`, `innerHTML`, and direct browser dialog sinks outside approved safe-rendering surfaces.

Any PR that changes unsafe DOM sink guard coverage, project-structure validation, or the verification script that wires the guard must keep this inventory updated. Existing feature code should route HTML rendering through approved safe utilities/components rather than adding new allowlist entries.

## Public runtime exposure guard

The frontend verification gate includes `npm run check:runtime-exposure`, which runs `scripts/guard-public-runtime-exposure.js`.

The guard scans public/runtime entry files for rehearsal-only and debug-only markers before build or smoke validation. Any PR that changes the public runtime exposure guard, its focused test script, or frontend project-structure validation must keep this inventory updated so operational reviewers can see why the runtime gate changed.

## Verify gate unit-test contract

The frontend verification gate runs static checks, build, focused unit tests, and smoke validation in one `npm run verify` path. Unit-test configuration lives in `vitest.config.ts`, and test dependencies are locked by `package-lock.json`.

Any PR that changes the verify script, unit-test wiring, TypeScript test config, or locked test dependencies must keep this inventory updated so CI behavior stays reviewable.

## Operational rule

Any PR that changes dependency preflight behavior, the runtime supervisor exit contract, Windows spawn compatibility, the runtime config accessor/env-validation contract, unsafe DOM sink guard coverage, public runtime exposure checks, frontend project-structure validation, or frontend verify/test wiring must update this document or another runtime inventory artifact in the same PR.
