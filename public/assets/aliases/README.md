# Alias Identity Assets

This directory contains alias identity SVGs used for user avatar display.

## Cross-Repo Contract

These files are shared with `lian-platform-server`. The backend `data/alias-pool.json` references these filenames as alias identity keys via `avatarUrl: "/assets/aliases/{id}.svg"`.

**Do not rename, remove, or reformat files in this directory without backend coordination.**

## Files

| File | Alias Identity | Design Tokens |
|---|---|---|
| `lumen-archivist.svg` | 微光档案员 | bg: #EAF7F4, fg: #0F766E, accent: #14B8A6, mark: archive |
| `harbor-guide.svg` | 港湾向导 | bg: #EEF2FF, fg: #4338CA, accent: #6366F1, mark: compass |
| `pine-scout.svg` | 松间侦察员 | bg: #F0FDF4, fg: #15803D, accent: #22C55E, mark: scope |
| `orange-bell.svg` | 橘铃提醒员 | bg: #FFF7ED, fg: #C2410C, accent: #F97316, mark: bell |
| `blueprint-maker.svg` | 蓝图整理师 | bg: #EFF6FF, fg: #1D4ED8, accent: #38BDF8, mark: grid |
| `greenroom-helper.svg` | 绿屋帮手 | bg: #ECFDF5, fg: #047857, accent: #10B981, mark: hand |
| `moon-table.svg` | 月台夜谈者 | bg: #F5F3FF, fg: #6D28D9, accent: #A78BFA, mark: moon |
| `cedar-witness.svg` | 雪松见证人 | bg: #F8FAFC, fg: #334155, accent: #0F766E, mark: shield |

## Rules

- Adding a new alias requires backend `alias-pool.json` update AND a new SVG here.
- Filenames are identity keys — changing them breaks existing user alias assignments.
- SVG format must be preserved for consistent rendering.
- Design tokens (bg, fg, accent, mark) must match backend `alias-pool.json`.
