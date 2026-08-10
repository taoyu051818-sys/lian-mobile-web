/**
 * Publish LLM preview tick (PRD V0.2 step E-pre).
 *
 * Watches the title + body refs that descend from `usePublishDraft`, debounces
 * keystrokes, then fires `POST /api/ai/post-preview` and pipes the response
 * into the candidate state machines (step B/D) plus the new
 * `suggestedComponents` ref (step E-main consumer).
 *
 * Why this lives at the composer level, not inside `usePublishDraft`:
 *
 *   - The candidate APIs are `provide()`d by `usePublishDraft`. Having the
 *     same composable also `inject()` them would be an order-dependent loop.
 *   - PublishComposer is the first descendant of the provider, so injecting
 *     here is straightforward and keeps the data flow uni-directional:
 *
 *         usePublishDraft  ──provide──>  PublishComposer ──inject──>  this hook
 *                                                                  └──> set*
 *
 * Triggering rules (PRD §4.1 + acceptance criteria from this PR):
 *
 *   1. Only fire after the user has paused typing for `debounceMs` (default
 *      800ms — PRD says "≥600ms"; 800ms is comfortably above the lower
 *      bound and matches the auto-trigger pause used elsewhere in the app).
 *   2. Don't fire on first mount when both fields are empty.
 *   3. If a fetch is in-flight and the user keeps typing, supersede with the
 *      latest tick (`inflight` counter) and **drop stale responses whose
 *      snapshot no longer matches** (race-safe; PRD: don't apply candidates
 *      derived from text the user has since rewritten).
 *   4. Network or LLM errors are silent — no toast, no clobber. Steps B/C
 *      already locked the "AI failure must not break publish" philosophy.
 *
 * What this PR does NOT do (E-main):
 *
 *   - Render `suggestedComponents`. We populate the ref and stop. The ghost
 *     UI (`PublishGhostComponent.vue` per PRD §5.1) lands in a follow-up.
 *   - Trigger on image upload or location pick. PRD §4.1 names both as
 *     additional triggers; we expose `refresh()` so the composer can wire
 *     them later without a re-design of this hook.
 */

import { onScopeDispose, watch, type Ref } from "vue";
import {
  fetchPublishLlmCandidates,
  type PublishLlmTickRequest,
  type PublishLlmTickResponse,
} from "../../api/aiPreview";
import type { InferredKind, SuggestedComponent } from "../../types/publishSuggestion";

/** PRD §4.1 floor is 600ms; we sit at 800ms to better tolerate burst typing. */
export const PUBLISH_LLM_TICK_DEBOUNCE_MS = 800;

export type PublishLlmTickFetcher = (
  request: PublishLlmTickRequest,
) => Promise<PublishLlmTickResponse>;

export interface UsePublishLlmTickOptions {
  /** Reactive title — usually the draft's title ref injected via the title-candidate API. */
  title: Ref<string>;
  /** Reactive body — usually the draft's body ref injected via the body-candidate API. */
  body: Ref<string>;
  /**
   * Optional uploaded image URLs. Used as additional grounding for the model
   * and to permit triggering even when title/body are still empty
   * (image-only flow per PRD §4.1).
   */
  imageUrls?: Ref<ReadonlyArray<string>>;
  /** Optional pre-bound location label, threaded into the LLM hint. */
  locationLabel?: Ref<string>;
  /** Shared publish-attempt generation. Form reset advances this ref. */
  attemptGeneration: Ref<number>;
  /** Apply the title candidate. Pass-through to the title state machine. */
  setTitleCandidate: (value: string | null) => void;
  /** Apply the body candidate. Pass-through to the body state machine. */
  setBodyCandidate: (value: string | null) => void;
  /** Sink for `candidates.suggestedComponents`. Hook owns writes here. */
  suggestedComponents: Ref<SuggestedComponent[]>;
  /**
   * Sink for `candidates.inferredKind` (PRD §4.3). Optional — when omitted
   * the hook silently drops the field. Wired by `usePublishDraft` so
   * `inferKind` (in `usePublishSubmit`) can pick it up as a low-priority
   * hint without breaking the existing E-pre call sites.
   *
   * Convention: `null` means "no LLM hint available" (degraded path or no
   * tick has landed yet); the inference chain treats `null` and `undefined`
   * identically — fall through to the deterministic place / text rules.
   */
  llmInferredKind?: Ref<InferredKind | null>;
  /** Override the network call (tests). Defaults to `fetchPublishLlmCandidates`. */
  fetcher?: PublishLlmTickFetcher;
  /** Override the debounce window (tests / future tuning). */
  debounceMs?: number;
}

export interface UsePublishLlmTickResult {
  /** Force one tick now, bypassing the debounce. */
  refresh: () => Promise<void>;
  /** Cancel any pending debounce timer. */
  cancel: () => void;
}

export function usePublishLlmTick(options: UsePublishLlmTickOptions): UsePublishLlmTickResult {
  const debounceMs = options.debounceMs ?? PUBLISH_LLM_TICK_DEBOUNCE_MS;
  const fetcher = options.fetcher ?? fetchPublishLlmCandidates;

  let timer: ReturnType<typeof setTimeout> | null = null;
  // Monotonic ticket — only the most recent fire's response is allowed to
  // mutate state. Older responses are quietly dropped.
  let inflight = 0;

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function snapshotInputsAreEmpty(title: string, body: string, imageCount: number): boolean {
    if (title.trim().length > 0) return false;
    if (body.trim().length > 0) return false;
    if (imageCount > 0) return false;
    return true;
  }

  function sameImages(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  async function fire() {
    const titleAtSend = options.title.value;
    const bodyAtSend = options.body.value;
    const imageUrlsAtSend = options.imageUrls ? Array.from(options.imageUrls.value) : [];
    const locationAtSend = options.locationLabel?.value ?? "";
    const generationAtSend = options.attemptGeneration.value;
    if (snapshotInputsAreEmpty(titleAtSend, bodyAtSend, imageUrlsAtSend.length)) {
      // Nothing to ground on; skip the round trip rather than waste tokens
      // on the model "what would you draft from nothing?".
      return;
    }
    const ticket = ++inflight;
    let response: PublishLlmTickResponse;
    try {
      response = await fetcher({
        title: titleAtSend,
        body: bodyAtSend,
        imageUrls: imageUrlsAtSend,
        locationLabel: locationAtSend,
      });
    } catch {
      // Silent fail — see file-level comment. Refs and candidate state are
      // left untouched so the user keeps the draft they had.
      return;
    }
    // Stale-response gate. Two checks, in order:
    //   1. Newer fire() superseded us → drop unconditionally.
    //   2. Snapshot mismatch (user kept typing during the round trip) → drop;
    //      candidates derived from older text would not match what the user
    //      sees now. createBodyCandidate's invalidation guard would also
    //      catch a stale set, but better to never call it.
    if (ticket !== inflight) return;
    if (generationAtSend !== options.attemptGeneration.value) return;
    if (options.title.value !== titleAtSend) return;
    if (options.body.value !== bodyAtSend) return;
    if (!sameImages(imageUrlsAtSend, options.imageUrls?.value ?? [])) return;
    if (locationAtSend !== (options.locationLabel?.value ?? "")) return;

    if (response.title !== null) options.setTitleCandidate(response.title);
    if (response.bodyCandidate !== null) options.setBodyCandidate(response.bodyCandidate);
    options.suggestedComponents.value = response.suggestedComponents;
    // PRD §4.3 — surface the LLM's `inferredKind` hint to the inference
    // chain. The hint is reset on every tick so a stale value from a prior
    // round trip never lingers; null signals "no opinion this turn".
    if (options.llmInferredKind) {
      options.llmInferredKind.value = response.inferredKind;
    }
  }

  async function refresh() {
    cancel();
    await fire();
  }

  // flush:"sync" so a keystroke immediately resets the debounce. With the
  // default "pre" flush a burst of keystrokes within one render frame would
  // collapse into a single watcher invocation, which still reschedules
  // correctly but feels less surgical when reading the code.
  const stopInputWatch = watch(
    [options.title, options.body],
    () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        void fire();
      }, debounceMs);
    },
    { flush: "sync" },
  );

  const stopAttemptWatch = watch(
    options.attemptGeneration,
    () => {
      cancel();
      inflight += 1;
    },
    { flush: "sync" },
  );

  onScopeDispose(() => {
    stopInputWatch();
    stopAttemptWatch();
    cancel();
    // Bump inflight so any in-flight response is considered stale and won't
    // touch refs after the host component unmounts.
    inflight += 1;
  });

  return { refresh, cancel };
}
