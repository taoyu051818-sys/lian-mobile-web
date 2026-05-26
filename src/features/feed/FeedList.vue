<script setup lang="ts">
import { computed } from "vue";
import type { FeedItem, FeedItemId } from "../../types/feed";
import FeedItemCard from "./FeedItemCard.vue";
import FeedItemClubCard from "./FeedItemClubCard.vue";

interface CardOpenPayload {
  item: FeedItem;
  rect: { top: number; left: number; width: number; height: number };
}

const props = defineProps<{ items: FeedItem[] }>();

const emit = defineEmits<{
  open: [id: FeedItemId, payload?: CardOpenPayload];
}>();

function isClubItem(item: FeedItem): boolean {
  return (
    item.contentType === "club" ||
    item.presentationIntent === "club" ||
    item.cardTemplate === "club"
  );
}

function estimateCardWeight(item: FeedItem) {
  // Club cards have a fixed height pattern
  if (isClubItem(item)) return 1.2;
  const coverWeight = item.cover ? 1.32 : 0.72;
  const titleWeight = Math.min(0.44, Math.max(0.18, item.title.length / 80));
  const bodyWeight = item.bodyPreview
    ? Math.min(0.62, Math.max(0.22, item.bodyPreview.length / 120))
    : 0;
  const metaWeight = 0.34;
  return coverWeight + titleWeight + bodyWeight + metaWeight;
}

function splitIntoMasonryColumns(sourceItems: FeedItem[]) {
  const columns: FeedItem[][] = [[], []];
  const weights = [0, 0];
  sourceItems.forEach((item) => {
    const columnIndex = weights[0] <= weights[1] ? 0 : 1;
    columns[columnIndex].push(item);
    weights[columnIndex] += estimateCardWeight(item);
  });
  return columns;
}

// Performance: use computed instead of watch + shallowRef. Computed properties
// are lazily evaluated and cached, avoiding unnecessary recalculations. The
// masonry layout only recomputes when the items array reference changes.
const masonryColumns = computed(() => splitIntoMasonryColumns(props.items));
</script>

<template>
  <div class="feed-list__masonry" aria-live="polite">
    <div
      v-for="(column, columnIndex) in masonryColumns"
      :key="columnIndex"
      class="feed-list__masonry-column"
    >
      <template v-for="item in column" :key="String(item.tid)">
        <FeedItemClubCard
          v-if="isClubItem(item)"
          :item="item"
          @open="(id, payload) => emit('open', id, payload)"
        />
        <FeedItemCard v-else :item="item" @open="(id, payload) => emit('open', id, payload)" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.feed-list__masonry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.feed-list__masonry-column {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
</style>
