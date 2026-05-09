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

## Verify gate unit-test contract

The frontend verification gate runs static checks, build, focused unit tests, and smoke validation in one `npm run verify` path. Unit-test configuration lives in `vitest.config.ts`, and test dependencies are locked by `package-lock.json`.

Any PR that changes the verify script, unit-test wiring, TypeScript test config, or locked test dependencies must keep this inventory updated so CI behavior stays reviewable.

## Operational rule

Any PR that changes dependency preflight behavior, the runtime supervisor exit contract, Windows spawn compatibility, or frontend verify/test wiring must update this document or another runtime inventory artifact in the same PR.
