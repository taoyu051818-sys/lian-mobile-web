<script setup lang="ts">
import { LianButton } from "../../ui";
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
          加载更多
        </LianButton>
        <FeedAutoLoadSentinel
          class="feed-load-more__sentinel"
          :enabled="canAutoLoadMore"
          @intersect="emit('loadMore')"
        />
      </div>
    </template>
    <span v-else>已经看到这里啦</span>
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
