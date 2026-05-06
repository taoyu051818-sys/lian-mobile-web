# Vue canary runtime

## Purpose

Vue development must be observable without replacing the current legacy frontend.

The project therefore keeps two frontend runtime lanes during migration:

| Lane | Purpose | Expected behavior |
| --- | --- | --- |
| Legacy frontend | Current production-compatible product experience | Continues to serve the existing mobile frontend |
| Vue canary | New Vue implementation under active development | Runs independently for review and testing |

## Port contract

- Legacy frontend keeps the existing frontend port.
- Vue canary uses port `4301`.
- Vue canary startup must fail if port `4301` is already occupied, rather than silently moving to another port.

## NPM scripts

Use these scripts instead of ad-hoc Vite commands:

| Script | Purpose |
| --- | --- |
| `npm run dev:vue-canary` | Run the Vue canary development server on port `4301` for local active development |
| `npm run preview:vue-canary` | Preview the built Vue app on port `4301` |
| `npm run test:vue-canary` | Run the frontend smoke check against the Vue canary port |

## Production supervisor behavior

The production frontend supervisor must serve Vue canary from the built `dist` output through Vite preview:

```bash
vite preview --host 0.0.0.0 --port 4301 --strictPort
```

It must not run the Vite development server in production:

```bash
vite --host 0.0.0.0 --port 4301 --strictPort
```

Running the development server in production exposes `/node_modules/.vite/deps/*` optimized dependency URLs and can trigger stale optimized dependency failures such as `Outdated Optimize Dep`.

## Migration rule

Vue canary is not the default product entrypoint.

A page may move from canary to default only after its legacy feature parity matrix is complete or its missing flows have explicit fallbacks.

## Operational rule

Any PR that changes the Vue canary port, startup behavior, default frontend entrypoint, or related smoke tests must update this document or another runtime inventory artifact in the same PR.
