/**
 * Event-publish draft state (PRD V0.1 §6.3 / §11.2).
 *
 * Adds a postType selector plus the event-only fields (startsAt, endsAt,
 * capacity, joinPolicy) on top of the base publish draft. Kept as a
 * standalone composable so the existing usePublishDraft stays focused on
 * the post fields shared across all post types.
 *
 * participantScope is intentionally NOT here — it reuses the existing
 * `visibility` ref from usePublishDraft so the user picks one audience for
 * the whole post, and the event surface only adds event-only fields.
 */

import { computed, ref } from "vue";
import type { EventJoinPolicy } from "../types/post-extensions";

export type PublishPostType = "post" | "event";

export function useEventPublishDraft() {
  const postType = ref<PublishPostType>("post");
  const startsAt = ref("");
  const endsAt = ref("");
  const capacity = ref("");
  const joinPolicy = ref<EventJoinPolicy>("open");

  const isEvent = computed(() => postType.value === "event");

  function reset() {
    postType.value = "post";
    startsAt.value = "";
    endsAt.value = "";
    capacity.value = "";
    joinPolicy.value = "open";
  }

  return {
    postType,
    startsAt,
    endsAt,
    capacity,
    joinPolicy,
    isEvent,
    reset,
  };
}
