<script setup lang="ts">
import {
  PROFILE_POSTS_CONTENT_FILTER_ALL,
  PROFILE_POSTS_CONTENT_FILTER_HELP,
  PROFILE_POSTS_CONTENT_FILTER_LABEL,
  PROFILE_POSTS_CONTENT_FILTER_MERCHANT,
  PROFILE_POSTS_CONTENT_FILTER_TRADE,
} from "../../config/brand";
import type { ProfilePostsContentFilter } from "../../types/profile";

defineProps<{
  modelValue: ProfilePostsContentFilter;
}>();

const emit = defineEmits<{
  select: [value: ProfilePostsContentFilter];
}>();

interface ChipDescriptor {
  value: ProfilePostsContentFilter;
  label: string;
}

// Order is the rendering order. "all" comes first as the default; merchant /
// trade / help mirror the backend POST_ALLOWED_PRESENTATION_INTENTS subset
// that maps cleanly to a posts-tab filter (event lives on metadata.event,
// out of scope for this PR — see brand comment).
const chips: readonly ChipDescriptor[] = [
  { value: "all", label: PROFILE_POSTS_CONTENT_FILTER_ALL },
  { value: "merchant", label: PROFILE_POSTS_CONTENT_FILTER_MERCHANT },
  { value: "trade", label: PROFILE_POSTS_CONTENT_FILTER_TRADE },
  { value: "help", label: PROFILE_POSTS_CONTENT_FILTER_HELP },
];

function pick(value: ProfilePostsContentFilter) {
  emit("select", value);
}
</script>

<template>
  <div
    class="profile-posts-content-filter"
    role="radiogroup"
    :aria-label="PROFILE_POSTS_CONTENT_FILTER_LABEL"
    data-testid="profile-posts-content-filter"
  >
    <button
      v-for="chip in chips"
      :key="chip.value"
      type="button"
      role="radio"
      class="profile-posts-content-filter__chip"
      :class="{ 'is-active': modelValue === chip.value }"
      :aria-checked="modelValue === chip.value"
      :data-filter-value="chip.value"
      data-testid="profile-posts-content-filter-chip"
      @click="pick(chip.value)"
    >
      {{ chip.label }}
    </button>
  </div>
</template>

<style scoped>
.profile-posts-content-filter {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  overflow-x: auto;
  padding: var(--space-1) 0;
  scrollbar-width: none;
}

.profile-posts-content-filter::-webkit-scrollbar {
  display: none;
}

.profile-posts-content-filter__chip {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.profile-posts-content-filter__chip:hover,
.profile-posts-content-filter__chip:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.profile-posts-content-filter__chip.is-active {
  background: var(--lian-primary, #1fa7a0);
  border-color: var(--lian-primary, #1fa7a0);
  color: #fff;
}

.profile-posts-content-filter__chip:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}
</style>
