<script setup lang="ts">
import { defineAsyncComponent, type Component, type PropType } from "vue";
import type { AppViewKey } from "./view-types";
import type { PageChromeSpec } from "../shell/page-model";
import FeedView from "../features/feed/FeedView.vue";
import ViewAsyncError from "./ViewAsyncError.vue";
import ViewLoadingFallback from "./ViewLoadingFallback.vue";

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
  map: asyncView(() => import("../features/map/MapLeafletView.vue")),
  publish: asyncView(() => import("../features/publish/PublishView.vue")),
  messages: asyncView(() => import("../features/messages/MessagesView.vue")),
  profile: asyncView(() => import("../features/profile/ProfileView.vue")),
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});

const emit = defineEmits<{
  chrome: [payload: PageChromeSpec];
}>();
</script>

<template>
  <div class="app-view-host">
    <KeepAlive include="MapLeafletView">
      <component :is="viewComponents[props.activeViewKey]" @chrome="emit('chrome', $event)" />
    </KeepAlive>
  </div>
</template>
