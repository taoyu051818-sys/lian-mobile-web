# Handoff: GDPlatform commerce frontend boundary

## Result

Recorded GDPlatform as the commercial system of record, LIAN as the same-origin BFF and experience
owner, and NodeBB as the community backend. The document separates commerce from errands and CNY
from points, keeps service credentials and the internal origin out of clients, and prevents a
default-on or indefinite LA compatibility fallback.

## Files

- `docs/architecture/gdplatform-commerce-frontend.md`
- `docs/agent/tasks/gd-commerce-frontend-boundary.md`
- `docs/agent/handoffs/gd-commerce-frontend-boundary.md`

## Runtime and contract impact

None. No source, route, API, environment, dependency, build or generated artifact changed.

## Validation

- Format-check the three changed Markdown files with the repository's locked Prettier.
- Run `git diff --check`.
- Confirm `git status --short` contains only these three files.

## Next task

After the LIAN backend exposes a neutral commerce read contract, create an implementation task for
the read-only store and product journeys. Do not copy the LA-specific route or DTO names.
