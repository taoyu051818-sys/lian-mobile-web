<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FeedItem, FeedItemId } from "../../types/feed";
import type { ClubMetadata } from "../../types/post";
import {
  CLUB_CARD_PRESIDENT_LABEL,
  CLUB_CARD_FOUNDED_LABEL,
  CLUB_CARD_MEMBERS_LABEL,
  CLUB_CATEGORY_LABELS,
  FEED_CARD_MARK_CLUB,
} from "../../config/brand";
import { useCardPointerInteraction } from "./useCardPointerInteraction";

const props = defineProps<{ item: FeedItem }>();
const emit = defineEmits<{
  open: [
    id: FeedItemId,
    payload?: {
      item: FeedItem;
      rect: { top: number; left: number; width: number; height: number };
    },
  ];
}>();

const club = computed<ClubMetadata | undefined>(() => props.item.club);
const clubName = computed(() => club.value?.name || props.item.title || "");
const category = computed(() => club.value?.category || "other");
const categoryLabel = computed(
  () => CLUB_CATEGORY_LABELS[category.value] || CLUB_CATEGORY_LABELS.other,
);
const president = computed(() => club.value?.president || "");
const memberCount = computed(() => club.value?.memberCount ?? 0);
const logoUrl = computed(() => club.value?.logoUrl || props.item.cover || "");
const foundedYear = computed(() => {
  const foundedAt = club.value?.foundedAt;
  if (!foundedAt) return "";
  const year = new Date(foundedAt).getFullYear();
  return Number.isFinite(year) ? year.toString() : "";
});

const logoError = ref(false);

// Reset logo error state when URL changes
watch(
  () => logoUrl.value,
  () => {
    logoError.value = false;
  },
);

function handleLogoError() {
  logoError.value = true;
}

const ariaLabel = computed(
  () => `${clubName.value}，${categoryLabel.value}社团，${memberCount.value}名成员`,
);

function emitOpen(target: HTMLElement | null) {
  const bounds = target?.getBoundingClientRect();
  emit(
    "open",
    props.item.tid,
    bounds
      ? {
          item: props.item,
          rect: {
            top: bounds.top,
            left: bounds.left,
            width: bounds.width,
            height: bounds.height,
          },
        }
      : undefined,
  );
}

const {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
  handleContextMenu,
  openCard,
  openCardFromKeyboard,
} = useCardPointerInteraction(emitOpen);
</script>

<template>
  <article
    class="club-card"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @contextmenu="handleContextMenu"
    @click="openCard"
    @keydown.enter.prevent="openCardFromKeyboard"
    @keydown.space.prevent="openCardFromKeyboard"
  >
    <div class="club-card__header">
      <div v-if="logoUrl && !logoError" class="club-card__logo">
        <img
          :src="logoUrl"
          :alt="clubName"
          loading="lazy"
          draggable="false"
          @error="handleLogoError"
        />
      </div>
      <div v-else class="club-card__logo club-card__logo--placeholder" aria-hidden="true">
        <span>{{ FEED_CARD_MARK_CLUB }}</span>
      </div>
      <span class="club-card__category">{{ categoryLabel }}</span>
    </div>

    <div class="club-card__body">
      <h3 class="club-card__name" :title="clubName">{{ clubName }}</h3>

      <dl class="club-card__meta">
        <div v-if="president" class="club-card__meta-item">
          <dt>{{ CLUB_CARD_PRESIDENT_LABEL }}</dt>
          <dd>{{ president }}</dd>
        </div>
        <div v-if="foundedYear" class="club-card__meta-item">
          <dt>{{ CLUB_CARD_FOUNDED_LABEL }}</dt>
          <dd>{{ foundedYear }}</dd>
        </div>
        <div class="club-card__meta-item club-card__meta-item--members">
          <dt>{{ CLUB_CARD_MEMBERS_LABEL }}</dt>
          <dd>{{ memberCount }}</dd>
        </div>
      </dl>
    </div>
  </article>
</template>

<style scoped>
.club-card {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(240, 253, 250, 0.86)),
    var(--lian-card-strong);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  transition:
    transform var(--motion-fast) var(--motion-ease-standard),
    box-shadow var(--motion-fast) var(--motion-ease-standard);
}

.club-card:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 3px;
}

.club-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.club-card__header {
  position: relative;
  display: grid;
  min-height: 100px;
  place-items: center;
  background: rgba(31, 167, 160, 0.08);
}

.club-card__logo {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-orb);
  background: var(--lian-card-strong);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.club-card__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  -webkit-user-drag: none;
}

.club-card__logo--placeholder {
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-primary-deep);
  font-size: 20px;
  font-weight: 900;
}

.club-card__category {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  max-width: calc(100% - var(--space-4));
  overflow: hidden;
  padding: 5px 8px;
  border: 1px solid rgba(31, 167, 160, 0.24);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.82);
  color: var(--lian-primary-deep);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}

.club-card__body {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
}

.club-card__name {
  margin: 0;
  overflow: hidden;
  color: var(--lian-ink);
  font-size: 15px;
  line-height: 1.34;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  color: var(--lian-muted);
  font-size: 11px;
}

.club-card__meta-item {
  display: flex;
  gap: 2px;
  align-items: center;
}

.club-card__meta-item dt {
  font-weight: 500;
}

.club-card__meta-item dd {
  margin: 0;
  font-weight: 800;
  color: var(--lian-ink);
}

.club-card__meta-item--members dd {
  color: var(--lian-primary-deep);
}
</style>
