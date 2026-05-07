<script setup lang="ts">
import { defineAsyncComponent, type Component, type PropType } from "vue";
import type { AppViewKey } from "./view-types";
import FeedView from "../views/FeedView.vue";
import ViewAsyncError from "./ViewAsyncError.vue";
import ViewLoadingFallback from "./ViewLoadingFallback.vue";

export type ChromeStatePayload = boolean | {
  hidden?: boolean;
  progress?: number;
};

function asyncView(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: ViewLoadingFallback,
    errorComponent: ViewAsyncError,
    timeout: 15000,
  });
}

const viewComponents: Record<AppViewKey, Component> = {
  feed: FeedView,
  map: asyncView(() => import("../views/MapLeafletView.vue")),
  publish: asyncView(() => import("../views/PublishView.vue")),
  messages: asyncView(() => import("../views/MessagesView.vue")),
  profile: asyncView(() => import("../views/ProfileView.vue")),
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});

const emit = defineEmits<{
  chrome: [payload: ChromeStatePayload];
}>();
</script>

<template>
  <div class="app-view-host">
    <component :is="viewComponents[props.activeViewKey]" @chrome="emit('chrome', $event)" />
  </div>
</template>
