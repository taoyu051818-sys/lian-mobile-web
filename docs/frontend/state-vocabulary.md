# State-class vocabulary (`.is-*`)

> Source of truth for the shared state-class names used across `src/`.
> Enforced by `tests/structure/state-class-vocabulary.test.ts` (vitest).

LIAN follows the Apple Music Web pattern: every Vue / CSS surface that exposes
a transient state on a DOM node uses one of a small, shared vocabulary of
`.is-*` classes. A new component does not invent its own state class — it
reaches for the right name from the list below.

The reason is concrete. When every "loading", "selected", "open" looks the
same in the source, refactoring and visual polish (focus rings, motion,
accessibility states) becomes a one-edit change in shared CSS instead of a
cross-feature scavenger hunt.

## Allowed state classes

Exactly these nine names are allowed on new code. New `.is-*` names must
come through a doc PR that updates this list (and the structure test will
fail until they do).

| Class          | Meaning                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.is-loading`  | Waiting on an async result (API call, upload, submit in flight). Mutually exclusive with `is-empty` / `is-error` / `is-success`.                                    |
| `.is-empty`    | Data is empty after a successful load. Empty is a settled state, not a loading state.                                                                               |
| `.is-error`    | Failure state (network / validation / business error).                                                                                                              |
| `.is-success`  | Settled positive result (saved, joined, sent). Mutually exclusive with `is-loading` / `is-error`. Used by the `LianButton` 6-state vocabulary as the "ack" partner. |
| `.is-disabled` | Disabled (insufficient permissions, prerequisite unmet, temporarily unavailable). Pair with `aria-disabled` or `disabled`.                                          |
| `.is-pressed`  | Pressed / toggled on. Pair with `aria-pressed="true"`. Use this for self-referential toggles (a like button on its own post, a bookmark icon).                      |
| `.is-selected` | Selected from a set. Pair with `aria-selected="true"` for tabs / segmented controls / multi-select. Use this when there are siblings the user could choose instead. |
| `.is-active`   | Currently active (route match, focus-within, currently-playing, dragging). A persistent "this is the live one" marker, not a toggle and not a selection.            |
| `.is-open`     | Expanded / open (accordion, dropdown, sheet, drawer). Pair with `aria-expanded="true"`.                                                                             |

## Mutual exclusivity

- `.is-loading`, `.is-empty`, and `.is-error` are mutually exclusive on the
  same element. A node is at most one of "loading", "settled-empty", or
  "failed".
- `.is-pressed` and `.is-selected` are not synonyms. `.is-pressed` describes a
  toggle on a single thing (this button is on); `.is-selected` describes
  picking from a set (this tab is the chosen one of N).
- `.is-active` is a third axis. A nav tab can be `.is-active` (its route is
  loaded) without being the user's `.is-selected` choice in a different
  picker. Re-use the right one rather than overloading.

## What does not belong here

- Visual variants (size, density, theme) — use BEM modifier classes
  (`.feed-card--compact`, `.feed-card--dense`).
- Domain semantics (`.is-warning`, `.is-required`, `.is-readonly` etc.) — name
  by purpose, not by state pattern: `.feed-card-warning`, `.field--required`,
  `.field--readonly`.
- Component-specific behaviors that have nothing to do with the eight
  vocabularies (`.is-confirming`, `.is-deferred`, `.is-self`) — these stay
  out of the `.is-*` namespace and use a component-scoped name instead.

## Lint guard

The structure test in `tests/structure/state-class-vocabulary.test.ts` scans
`src/**/*.{vue,css}` and matches three forms:

1. CSS selectors: `.is-foo`
2. Quoted bindings: `:class="{ 'is-foo': ... }"` and `:class="['is-foo']"`
3. Static template attributes: `class="... is-foo ..."`

Every name not on the allow-list above must be in
`tests/structure/state-class-grandfathered.json` until it gets renamed or
the doc PR adopts it. The grandfathered list is **only allowed to shrink**:
adding a new class to it should fail review. Use a follow-up PR to either
rename to a vocabulary entry or move the class out of the `.is-*` namespace.

## Migration pointers (for follow-ups)

These renames are obvious and safe to fold into the vocabulary in a
follow-up PR:

| Current class     | Suggested target                                                     |
| ----------------- | -------------------------------------------------------------------- |
| `.is-expanded`    | `.is-open`                                                           |
| `.is-liked`       | `.is-pressed` + `aria-pressed`                                       |
| `.is-pending`     | `.is-loading`                                                        |
| `.is-revoked`     | component-scoped class                                               |
| `.is-single`      | BEM modifier                                                         |
| `.is-current`     | `.is-active`                                                         |
| `.is-static`      | inverted: `.is-clickable` already exists; keep both component-scoped |
| `.is-detail-open` | component-scoped (shell-level)                                       |
| `.is-self`        | component-scoped (`messages-view__message--self`)                    |
| `.is-compact`     | BEM modifier (`__composer--compact`)                                 |

These judgment calls live in the rename PR (`PR-γ-2`), not here.
