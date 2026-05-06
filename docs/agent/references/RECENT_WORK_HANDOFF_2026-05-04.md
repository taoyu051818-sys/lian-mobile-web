# Recent Work Handoff - 2026-05-04

> Superseded by `RECENT_WORK_HANDOFF_2026-05-05.md` for repo ownership and deployment orientation. As of 2026-05-05, backend is `lian-platform-server`, frontend is `lian-mobile-web`, and `lian-mobile-web-full` is stopped/decommissioned as an active full-stack source.

This archived handoff is retained only as historical context. Runtime commands, process names, ports, and deployment aliases must not be copied from this file.

For current operational guidance, use:

- `docs/agent/RUNTIME_INVENTORY.md`
- `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-05.md`
- `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-05.md`

## Historical product decisions captured here

- Publish is a standalone page, not a modal.
- Publish supports multi-image input.
- AI creates editable drafts only and must not auto-publish or auto-expand audience.
- Replies are discussion messages, not private chat.
- Profile contains browsing history, saved posts, and liked posts.
- Save and report live on detail, not feed cards.
- Post detail can link to location.
- Map v2 uses Gaode tiles plus LIAN overlay layers.
- Raw road network preview is admin/editor only.
- Map development remains human-assisted only.

## Historical accepted behavior

The user manually confirmed the following earlier work:

- Publish V2 main flow passed.
- Like/unlike, save/unsave, report passed.
- My saved posts, liked posts, and browsing history passed.
- Publish page residual view issue was fixed.
- Reply/discussion messages appear in the intended messages area.
- Detail like UI was accepted as the red filled-heart state.

## Runtime command policy

Do not write guessed restart commands or guessed process names in archived docs. When an operation needs a restart, lookup the approved command/service name in the runtime inventory first, then follow the current runbook.

## Server data reminder

If runtime data such as `data/post-metadata.json` conflicts on the server, do not discard it blindly. It may contain live runtime metadata. Back it up first, then resolve deliberately.
