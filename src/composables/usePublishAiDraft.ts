import { onScopeDispose, ref, watch, type Ref } from "vue";
import {
  fetchAiPostPreview,
  type AiPreviewRequest,
  type AiPreviewSuggestions,
} from "../api/aiPublish";
import { LianApiError } from "../api/http";
import { PUBLISH_AI_UNAVAILABLE } from "../config/brand";

export interface UsePublishAiDraftOptions {
  /** Latest list of uploaded image URLs. Triggers a draft when first becomes non-empty. */
  uploadedImageUrls: Ref<string[]>;
  /** Currently typed title — sent to the model as a hint when present. */
  title: Ref<string>;
  /** Currently typed body — same semantics as `title`. */
  body: Ref<string>;
  /** Currently selected/typed location label. Sent to the model for grounding. */
  locationLabel: Ref<string>;
  /** Shared publish-attempt generation. Resetting the form advances this ref. */
  attemptGeneration: Ref<number>;
  /**
   * Called once per successful preview with the parsed suggestion bundle.
   * The caller decides what to apply (see `domain/publishAiPolicy`); this
   * composable does not embed any business rules.
   */
  onSuggestion: (suggestion: AiPreviewSuggestions) => void;
  /** Override the network request in behavior tests. */
  fetcher?: PublishAiDraftFetcher;
}

export type PublishAiDraftFetcher = (request: AiPreviewRequest) => Promise<AiPreviewSuggestions>;

export interface UsePublishAiDraftResult {
  loading: Ref<boolean>;
  error: Ref<string>;
  suggestions: Ref<AiPreviewSuggestions | null>;
  riskFlags: Ref<string[]>;
  /** Force a fresh suggestion request even if one already ran. */
  refresh: () => Promise<void>;
}

/**
 * Drives AI draft suggestions for the publish flow (PRD V0.1 Phase 3).
 *
 * Behavior:
 *   - Watches `uploadedImageUrls`. The first time the list becomes non-empty,
 *     fires `/api/ai/post-preview`. Subsequent uploads do NOT auto-refresh;
 *     callers can request another pass via `refresh()`.
 *   - Backend missing / rate limited / 5xx → silent no-op. The UI keeps
 *     working with manual input and surfaces no error in that case.
 *   - Other errors (4xx auth, network) surface via `error` so the UI can
 *     show a small chip without blocking publish.
 *   - Decisions about *which* fields to fill live in
 *     `domain/publishAiPolicy.planAiSuggestionPatch` — see `onSuggestion`.
 */
export function usePublishAiDraft(options: UsePublishAiDraftOptions): UsePublishAiDraftResult {
  const fetcher = options.fetcher ?? fetchAiPostPreview;
  const loading = ref(false);
  const error = ref("");
  const suggestions = ref<AiPreviewSuggestions | null>(null);
  const riskFlags = ref<string[]>([]);
  let hasRun = false;
  let inflight = 0;

  function sameImages(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function resetTransientState() {
    inflight += 1;
    hasRun = false;
    loading.value = false;
    error.value = "";
    suggestions.value = null;
    riskFlags.value = [];
  }

  async function run() {
    const imageUrlsAtSend = Array.from(options.uploadedImageUrls.value);
    if (!imageUrlsAtSend.length) return;
    const titleAtSend = options.title.value;
    const bodyAtSend = options.body.value;
    const locationAtSend = options.locationLabel.value;
    const generationAtSend = options.attemptGeneration.value;
    const ticket = ++inflight;
    loading.value = true;
    error.value = "";

    function requestIsCurrent(): boolean {
      if (ticket !== inflight) return false;
      return (
        generationAtSend === options.attemptGeneration.value &&
        titleAtSend === options.title.value &&
        bodyAtSend === options.body.value &&
        locationAtSend === options.locationLabel.value &&
        sameImages(imageUrlsAtSend, options.uploadedImageUrls.value)
      );
    }

    try {
      const result = await fetcher({
        imageUrls: imageUrlsAtSend,
        hint: [titleAtSend, bodyAtSend].filter(Boolean).join("\n"),
        locationLabel: locationAtSend,
      });
      if (!requestIsCurrent()) return;
      suggestions.value = result;
      riskFlags.value = result.riskFlags;
      options.onSuggestion(result);
    } catch (err) {
      if (!requestIsCurrent()) return;
      // Soft-fail responses already became EMPTY_SUGGESTIONS in the client;
      // anything reaching here is an actual auth/network problem. Surface it
      // briefly but don't throw — publish must still work without AI.
      error.value = err instanceof LianApiError ? err.message : PUBLISH_AI_UNAVAILABLE;
    } finally {
      if (ticket === inflight && generationAtSend === options.attemptGeneration.value) {
        loading.value = false;
      }
    }
  }

  const stopWatch = watch(
    () => options.uploadedImageUrls.value.length,
    (next, prev) => {
      // Trigger only on the empty → non-empty transition, once per attempt.
      if (!hasRun && (prev ?? 0) === 0 && next > 0) {
        hasRun = true;
        void run();
      }
    },
    { immediate: false },
  );

  const stopAttemptWatch = watch(options.attemptGeneration, resetTransientState, {
    flush: "sync",
  });

  onScopeDispose(() => {
    stopWatch();
    stopAttemptWatch();
    inflight += 1;
  });

  async function refresh() {
    hasRun = true;
    await run();
  }

  return { loading, error, suggestions, riskFlags, refresh };
}
