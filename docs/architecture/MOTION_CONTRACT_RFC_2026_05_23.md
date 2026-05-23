# Motion contract RFC (2026-05-23)

Status: draft (this RFC sets the contract; sub-task PRs apply it across components)
Owners: LIAN frontend / Apple-tier polish lane
Scope: `lian-mobile-web` motion / transition / animation. Establishes the rules every interactive component should follow.

## 1. Why this RFC exists

Apple Music Web bundle audit (2026-05-23, see `[[project-apple-music-gap-analysis]]` memory) found four motion-related gaps between LIAN and Apple-tier polish:

1. **Motion vocabulary is 1/4 of Apple's**: `lian-tokens.css` has 4 ease curves and 4 durations, but only one shorthand (`--motion-transition`) and zero component-level guidance about which combination to use when.
2. **`transition:` is almost absent in source**: a grep of `transition:` mostly returns `transition: none` (reduced-motion fallbacks). The default state is "no transition", so users perceive state changes as **flashes**, not transitions.
3. **State changes are abrupt** even where the visual delta is small (e.g. `is-loading` → done, `is-pressed` release, sheet dismiss). Apple uses a 200-300ms ease on all of these.
4. **No consistent reduced-motion strategy** at component level. The `useReducedMotion` composable exists in Vue but most components don't read it; reduced-motion only kicks in via global CSS.

The PR-α/β/γ wave landed the **tokens** (4 ease curves + 4 durations + transition shorthand + `.is-*` state vocabulary). This RFC defines **the contract for using those tokens** — durations × eases × property allowlist × reduced-motion behavior — so every interactive component speaks the same motion language without ad-hoc tweaking.

This RFC does **not** introduce new tokens. It commits the existing tokens to specific roles.

## 2. Current state (what's already on main, 2026-05-23)

`src/styles/lian-tokens.css`:

```css
--motion-fast: 160ms;
--motion-micro: 120ms;
--motion-standard: 220ms;
--motion-return: 380ms;

--motion-ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1);
--motion-ease-decelerate: cubic-bezier(0.52, 0.16, 0.52, 0.84);
--motion-ease-emphasized: cubic-bezier(0.04, 0.04, 0.12, 0.96);
--motion-ease-overshoot: cubic-bezier(0.76, 0.665, 0.37, 1.35);

--motion-transition: opacity var(--motion-fast) var(--motion-ease-standard);
```

`src/composables/useReducedMotion.ts`: SSR-safe reactive `Ref<boolean>` reflecting `(prefers-reduced-motion: reduce)`. Returns `false` on the server; lands the real value on the next tick after hydration.

`tests/structure/state-class-vocabulary.test.ts`: enforces `.is-*` classes belong to the 8-word allowlist (`is-loading / is-empty / is-error / is-disabled / is-pressed / is-selected / is-active / is-open`).

LianButton 6-state vocabulary (PR-δ, mw#843) wires `aria-pressed` and the canonical `.is-*` set on the shared base.

**This RFC is built on top of those landed primitives.** It does not re-litigate any of them.

## 3. The contract

### 3.1 Duration × ease assignment

Each interaction class gets exactly **one** duration / ease pair. Components may not invent new pairings.

| Interaction class                          | Duration            | Ease                       | Why                                                          |
| ------------------------------------------ | ------------------- | -------------------------- | ------------------------------------------------------------ |
| Hover state, button press feedback         | `--motion-micro`    | `--motion-ease-standard`   | Fastest perceptible easing — no perception of "delay"        |
| State class flips (`.is-*`)                | `--motion-fast`     | `--motion-ease-standard`   | Just enough to register, no lag                              |
| Sheet/modal/drawer open                    | `--motion-standard` | `--motion-ease-emphasized` | Strong start, smooth land — "intentional reveal"             |
| Sheet/modal/drawer close                   | `--motion-standard` | `--motion-ease-decelerate` | Quick start, slow finish — "graceful exit"                   |
| Toast / inline feedback appearance         | `--motion-standard` | `--motion-ease-decelerate` | Reads like the result is "settling in"                       |
| Element returning to rest (e.g. drag back) | `--motion-return`   | `--motion-ease-overshoot`  | Slight bounce signals "snapped back" rather than "fell back" |
| Page transitions (between hash routes)     | `--motion-standard` | `--motion-ease-emphasized` | Same affordance as sheet open — context shift                |

**Anti-pattern**: using `--motion-ease-overshoot` for hover or for sheet open. Overshoot is reserved for "return to rest" semantics — using it elsewhere makes UI feel jittery.

### 3.2 Property allowlist

Transitions may target only these CSS properties:

- `opacity`
- `transform`
- `background-color`
- `color`
- `border-color`
- `box-shadow`

**Banned from `transition:`**:

- `width / height` — reflows are expensive and stutter; use `transform: scale()` instead, or animate only when entering/leaving via class binding
- `top / left / right / bottom` — same reason; use `transform: translate()`
- `margin / padding` — reflow trap
- `filter` (except for cases under §3.5) — paint expensive, often janky on mobile
- `all` — Apple does not use it; sweeps in unrelated properties when the cascade changes

If a layout-affecting change _must_ be animated (e.g. expanding a card), use `transform` + `transform-origin`, or animate `opacity` on a discrete swap-in element.

### 3.3 Reduced-motion contract

Two mechanisms; both must be respected:

**Global CSS override** (already present): the global `prefers-reduced-motion` rule sets `transition: none !important` on most elements. This catches CSS-only transitions.

**Component-level `useReducedMotion`** (the Vue path): components that produce motion via JS (drag inertia, programmatic scroll, animated SVG, page-route transitions) **must** read `useReducedMotion()` and short-circuit to instant when `reduced.value === true`.

The contract:

```ts
// Inside a component
import { useReducedMotion } from "@/composables/useReducedMotion";

const reduced = useReducedMotion();

function transitionToNextRoute() {
  if (reduced.value) {
    applyImmediately();
    return;
  }
  // animated path
  animate({ duration: 220, easing: easeStandard });
}
```

**Why both mechanisms**: CSS-only handles hover/state-class transitions. The composable handles every motion path that CSS can't reach (canvas, SVG `animate`, JS-driven scroll, route transitions).

**Reduced motion does not mean no motion.** Per Apple's HIG, reduced-motion users still benefit from a brief 1-frame opacity fade on appearance — what they don't want is **traversal motion** (sliding, parallax, page-flip-style transitions). When in doubt, kill the _direction_ of movement but keep a `--motion-micro` opacity step.

### 3.4 Component-level vs page-level motion

- **Component motion** is owned by the component (LianButton press feedback, Sheet open/close, Toast slide-in). Use the table in §3.1; do not add component-specific tokens.
- **Page-level motion** (route changes, app boot) goes through a single `<RouteTransition>` wrapper (does not yet exist; phase 2 of this RFC adds it). Until that wrapper exists, **route changes have no transition** — better silent than inconsistent.

### 3.5 Allowed exceptions

`filter: blur()` may be transitioned for the glass surface backdrop crossfade only. This is the single non-allowlist property Apple uses extensively. Limit to <= 12px blur delta to avoid mobile compositor jank.

## 4. Implementation waves

This RFC is the contract. The **application** lands as four narrow PRs:

### Wave 2-A: LianButton + LianSheet apply §3.1 fully

Audit `LianButton.vue` and `LianSheet.vue` (or whichever Sheet primitive exists). Verify every state transition uses the table-mandated pair. Convert any ad-hoc `transition:` to a `var(--motion-transition-{role})` shorthand if a new shorthand is needed; otherwise inline the `var(--motion-{duration}) var(--motion-ease-{kind})` pattern.

**Ship target**: ~30 lines across 2 files. Adds 0-2 new tokens (only if §3.1 reveals a missing combination).

<!-- 待 wave 2-A 实施 -->

### Wave 2-B: Toast / NotificationList composer apply §3.1 + §3.3

Toast and channel-row "new message" appearance currently flash. Apply standard-decelerate per table. NotificationList items already gained the canonical `.is-*` words in PR-γ-2 (#853); now wire transitions to those flips.

Audit `useReducedMotion` adoption: any component reaching for `requestAnimationFrame` or `setTimeout > 100ms` without reading `reduced.value` is a violation. Add the read.

**Ship target**: ~50 lines across 4-6 files.

<!-- 待 wave 2-B 实施 -->

### Wave 2-C: structure test for property allowlist

Add `tests/structure/motion-property-allowlist.test.ts`. Scans all `.vue` and `.css` files for `transition:` declarations and asserts the property is in §3.2's allowlist (or `none`). False positives (e.g. `transition-property: width` for a justified animation) go to a small `tests/structure/motion-allowlist-grandfathered.json`, identical to the `.is-*` grandfathered fixture pattern.

This guards future regressions — the same way state-class vocab now does.

**Ship target**: 1 test file + grandfathered fixture; surfaces real violations as part of the same PR.

**Status**: implemented in mw#856 (`tests/structure/motion-property-allowlist.test.ts` + `tests/structure/motion-property-allowlist-grandfathered.json`).

### Wave 2-D: `<RouteTransition>` shell (depends on SSR phase 2)

Once SSR/PWA phase 2 lands the routing primitive, wrap route transitions in a single `<RouteTransition>` component using `--motion-standard` × `--motion-ease-emphasized`. Reads `useReducedMotion()` and short-circuits.

**Ship target**: 1 new SFC + integration in `App.vue`. Block on SSR phase 2 (`docs/architecture/SSR_PWA_RFC_2026_05_23.md` §6).

<!-- 待 wave 2-D 实施 -->

## 5. What this RFC is NOT doing

- **No new ease curves or durations.** The 4×4 grid covers every case audited. If a future component needs a 5th, propose an amendment to §3.1 — do not inline a `cubic-bezier(...)` literal.
- **No animation library.** `@vueuse/motion`, Motion One, GSAP — none. CSS transitions + `Transition` Vue primitive cover this contract. Adding a library would reintroduce the "every component invents its own motion" problem that the table closes.
- **No haptic feedback.** Out of scope; that's a separate native-bridge discussion and the Native lane is dropped per SSR/PWA RFC.
- **No spring physics.** Reduced-motion users can't use them; non-reduced users gain little here. Not Apple Music's pattern either.
- **No micro-interaction polish on admin / dev-only screens.** Motion contract applies to user-facing surfaces; back-office lists do not need 220ms transitions.
- **No retroactive sweep of existing transitions.** Existing transitions that violate the contract get caught by Wave 2-C's test and queued as follow-ups; this RFC does not block on a 50-file find-and-replace.

## 6. Acceptance criteria

This RFC is "applied" when:

1. LianButton and LianSheet pass §3.1 audit (Wave 2-A).
2. Toast + NotificationList + at least one composer surface pass §3.1 + §3.3 (Wave 2-B).
3. `motion-property-allowlist.test.ts` runs in the structure test suite and is green (Wave 2-C).
4. `<RouteTransition>` exists when route transitions exist (Wave 2-D, blocked on SSR phase 2 — accept as deferred).
5. Apple Music gap analysis memory's gap #2 ("transition almost absent") is no longer a true statement of LIAN's source — at least 10 components with intentional transitions following this contract.

## 7. Cross-references

- Source of motion gap analysis: `[[project-apple-music-gap-analysis]]` memory.
- Reduced-motion composable contract: `src/composables/useReducedMotion.ts` JSDoc, and SSR/PWA RFC §6 phase 1.5.
- State class vocabulary (already canonical): `tests/structure/state-class-vocabulary.test.ts`.
- LianButton 6-state base (PR-δ): mw#843.
- Messages slice rename (PR-γ-2): mw#853.
- Tokens-only motion PR (PR-α): merged, see ownership doc.
- Property allowlist guard (Wave 2-C): mw#856.

## 8. Open questions (defer to first sub-PR)

- **Q1**: Should `--motion-standard` be 220ms or 240ms? Apple album page uses 240ms for sheet open; LIAN currently defines 220ms. Difference is below perception threshold but consistency with Apple bundle is a goal. Decide during Wave 2-A audit; if 240ms is right, adjust the token in the same PR (not a separate one).
- **Q2**: Is `box-shadow` in the property allowlist OK on mobile, or do we restrict to compositor-friendly properties only? GPU-accelerated `box-shadow` is fine for static-color shadows; problematic for animated colored shadows. Resolve in Wave 2-C when the allowlist test sees the real violations.
- **Q3**: Does `<RouteTransition>` need separate enter/leave eases, or is `emphasized` for both acceptable? Defer to Wave 2-D after SSR phase 2 routes exist to test against.

These are not blockers for adopting the contract; they are first-PR calibration calls.
