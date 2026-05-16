<script setup lang="ts">
import { LianButton } from "../../ui";
import { FEED_LOAD_MORE, FEED_SEEN_ALL } from "../../config/brand";
import FeedAutoLoadSentinel from "./FeedAutoLoadSentinel.vue";

defineProps<{
  hasMore: boolean;
  loadingMore: boolean;
  canAutoLoadMore: boolean;
}>();

const emit = defineEmits<{
  loadMore: [];
}>();
</script>

<template>
  <div class="feed-load-more">
    <template v-if="hasMore">
      <div class="feed-load-more__stack">
        <LianButton
          :loading="loadingMore"
          variant="ghost"
          @click="emit('loadMore')"
        >
          {{ FEED_LOAD_MORE }}
        </LianButton>
        <FeedAutoLoadSentinel
          class="feed-load-more__sentinel"
          :enabled="canAutoLoadMore"
          @intersect="emit('loadMore')"
        />
      </div>
    </template>
    <span v-else>{{ FEED_SEEN_ALL }}</span>
  </div>
</template>

<style scoped>
.feed-load-more {
  display: grid;
  place-items: center;
  padding-bottom: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
}

.feed-load-more__stack {
  display: grid;
  justify-items: center;
  width: 100%;
}

.feed-load-more__sentinel {
  width: 100%;
  height: 1px;
}
</style>
