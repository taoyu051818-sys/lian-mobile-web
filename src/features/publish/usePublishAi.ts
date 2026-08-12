import type { Ref } from "vue";
import { usePublishAiDraft } from "../../composables/usePublishAiDraft";
import { planAiSuggestionPatch } from "../../domain/publishAiPolicy";
import type { AudienceVisibility } from "../../types/audience";
import type { PublishVisibility } from "../../types/publish";

interface UsePublishAiOptions {
  uploadedImageUrls: Ref<string[]>;
  title: Ref<string>;
  body: Ref<string>;
  tagInput: Ref<string>;
  placeName: Ref<string>;
  attemptGeneration: Ref<number>;
  visibility: Ref<PublishVisibility>;
  isAllowed: (value: AudienceVisibility) => boolean;
}

/**
 * AI suggestion glue for the publish view (PRD V0.1 Phase 3 / §7.4.2).
 *
 * Runs the underlying AI composable and pipes accepted suggestions into the
 * draft refs. Extracted from `usePublishDraft` so the policy decision (what
 * to apply, gated by `domain/publishAiPolicy`) stays adjacent to where the
 * patch is written, instead of being buried in a 300-line god composable.
 */
export function usePublishAi(options: UsePublishAiOptions) {
  const ai = usePublishAiDraft({
    uploadedImageUrls: options.uploadedImageUrls,
    title: options.title,
    body: options.body,
    locationLabel: options.placeName,
    attemptGeneration: options.attemptGeneration,
    onSuggestion: (suggestion) => {
      const patch = planAiSuggestionPatch(
        {
          title: options.title.value,
          body: options.body.value,
          tag: options.tagInput.value,
          visibility: options.visibility.value,
        },
        suggestion,
        (value) => options.isAllowed(value as AudienceVisibility),
      );
      if (patch.title !== undefined) options.title.value = patch.title;
      if (patch.body !== undefined) options.body.value = patch.body;
      if (patch.tag !== undefined) options.tagInput.value = patch.tag;
      if (patch.visibility !== undefined) options.visibility.value = patch.visibility;
    },
  });

  return {
    aiLoading: ai.loading,
    aiError: ai.error,
    aiRiskFlags: ai.riskFlags,
    aiRefresh: ai.refresh,
  };
}
