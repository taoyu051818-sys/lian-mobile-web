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

## Unsafe DOM sink guard

The frontend verification gate includes `scripts/guard-unsafe-dom-sinks.js` to block newly introduced raw `v-html`, `innerHTML`, and direct browser dialog sinks outside approved safe-rendering surfaces.

Any PR that changes unsafe DOM sink guard coverage, project-structure validation, or the verification script that wires the guard must keep this inventory updated. Existing feature code should route HTML rendering through approved safe utilities/components rather than adding new allowlist entries.

## Operational rule

Any PR that changes dependency preflight behavior, the runtime supervisor exit contract, Windows spawn compatibility, unsafe DOM sink guard coverage, or frontend project-structure validation must update this document or another runtime inventory artifact in the same PR.
