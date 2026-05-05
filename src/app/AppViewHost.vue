<script setup lang="ts">
import type { AppViewKey } from "./view-types";
import type { PropType } from "vue";
import FeedView from "../views/FeedView.vue";
import MapView from "../views/MapView.vue";
import MessagesView from "../views/MessagesView.vue";
import ProfileView from "../views/ProfileView.vue";
import PublishView from "../views/PublishView.vue";

const viewComponents = {
  feed: FeedView,
  map: MapView,
  publish: PublishView,
  messages: MessagesView,
  profile: ProfileView,
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});

const emit = defineEmits<{
  chrome: [hidden: boolean];
}>();
</script>

<template>
  <Transition name="app-view" mode="out-in">
    <div :key="props.activeViewKey" class="app-view-host">
      <component :is="viewComponents[props.activeViewKey]" @chrome="emit('chrome', $event)" />
    </div>
  </Transition>
</template>

<style scoped>
.app-view-enter-active,
.app-view-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.app-view-enter-from,
.app-view-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.992);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .app-view-enter-active,
  .app-view-leave-active {
    transition: none;
  }

  .app-view-enter-from,
  .app-view-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
