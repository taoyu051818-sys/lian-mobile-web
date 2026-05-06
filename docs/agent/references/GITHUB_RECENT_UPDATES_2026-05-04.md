# GitHub Recent Updates - 2026-05-04

> Superseded by `GITHUB_RECENT_UPDATES_2026-05-05.md` for repo ownership and deployment orientation. As of 2026-05-05, backend is `lian-platform-server`, frontend is `lian-mobile-web`, and `lian-mobile-web-full` is stopped/decommissioned as an active full-stack source.

This archived note is retained only as a historical pointer. Runtime commands, process names, ports, and deployment service aliases must not be copied from this file.

For current operational steps, use the runtime inventory and current handoff docs:

- `docs/agent/RUNTIME_INVENTORY.md`
- `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-05.md`
- `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-05.md`

## Historical scope

The original 2026-05-04 note covered:

- production/development security mode;
- production-only same-origin checks;
- production auth rate limiting;
- setup/status exposure rules;
- security headers for API and static assets;
- secure cookies in production;
- fixed header scroll regression after view transitions;
- detail page and reply layout refinements;
- publish, map, metadata, route, and audience stabilization work.

## Runtime command policy

Do not write guessed restart commands or guessed process names in archived docs. When an operation needs a restart, lookup the approved command/service name in the runtime inventory first, then follow the current runbook.

## Server update reminder

Server-side metadata such as `data/post-metadata.json` may contain live runtime updates and can conflict during pulls. Back it up before resolving deploy conflicts.
