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

## Operational rule

Any PR that changes dependency preflight behavior, the runtime supervisor exit contract, or Windows spawn compatibility must update this document or another runtime inventory artifact in the same PR.
