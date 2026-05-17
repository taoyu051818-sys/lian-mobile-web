import { ref, watch, type Ref } from "vue";
import { fetchAiPostPreview, type AiPreviewSuggestions } from "../api/aiPublish";
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
  /**
   * Called once per successful preview with the parsed suggestion bundle.
   * The caller decides what to apply (see `domain/publishAiPolicy`); this
   * composable does not embed any business rules.
   */
  onSuggestion: (suggestion: AiPreviewSuggestions) => void;
}

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
  const loading = ref(false);
  const error = ref("");
  const suggestions = ref<AiPreviewSuggestions | null>(null);
  const riskFlags = ref<string[]>([]);
  let hasRun = false;
  let inflight = 0;

  async function run() {
    const urls = options.uploadedImageUrls.value;
    if (!urls.length) return;
    const ticket = ++inflight;
    loading.value = true;
    error.value = "";
    try {
      const result = await fetchAiPostPreview({
        imageUrls: urls,
        hint: [options.title.value, options.body.value].filter(Boolean).join("\n"),
        locationLabel: options.locationLabel.value,
      });
      // Drop responses for stale runs — keep the latest call authoritative.
      if (ticket !== inflight) return;
      suggestions.value = result;
      riskFlags.value = result.riskFlags;
      options.onSuggestion(result);
    } catch (err) {
      if (ticket !== inflight) return;
      // Soft-fail responses already became EMPTY_SUGGESTIONS in the client;
      // anything reaching here is an actual auth/network problem. Surface it
      // briefly but don't throw — publish must still work without AI.
      error.value = err instanceof LianApiError ? err.message : PUBLISH_AI_UNAVAILABLE;
    } finally {
      if (ticket === inflight) loading.value = false;
    }
  }

  watch(
    () => options.uploadedImageUrls.value.length,
    (next, prev) => {
      // Trigger only on the empty → non-empty transition, once per session.
      if (!hasRun && (prev ?? 0) === 0 && next > 0) {
        hasRun = true;
        void run();
      }
    },
    { immediate: false },
  );

  async function refresh() {
    hasRun = true;
    await run();
  }

  return { loading, error, suggestions, riskFlags, refresh };
}
