# Vue/Vite runtime

> **Updated by PR #282.** The legacy static runtime was removed and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy. Vue/Vite is now the sole active web runtime. The "canary" framing is historical.

## Purpose

Vue/Vite is the active web frontend runtime.

## Port contract

- Vite preview uses port `4173` by default.
- Vite dev server uses port `5173` by default.

## NPM scripts

| Script            | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `npm run dev`     | Run the Vite development server for local active development |
| `npm run preview` | Preview the built Vue app                                    |
| `npm run build`   | Build the Vue app for production                             |
| `npm run verify`  | Run static checks, build, and smoke                          |

## Production behavior

Production must serve from the built `dist` output through Vite preview, not the Vite development server. Running the development server in production exposes `/node_modules/.vite/deps/*` optimized dependency URLs.

## Operational rule

Any PR that changes the Vite port, startup behavior, or related smoke tests must update this document or another runtime inventory artifact in the same PR.
