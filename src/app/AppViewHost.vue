<script setup lang="ts">
import { defineAsyncComponent, type Component, type PropType } from "vue";
import type { AppViewKey } from "./view-types";
import type { PageChromeSpec } from "../shell/page-model";
import { FeedView } from "../features/feed";
import ViewAsyncError from "./ViewAsyncError.vue";
import ViewLoadingFallback from "./ViewLoadingFallback.vue";

function asyncView(loader: () => Promise<Component>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: ViewLoadingFallback,
    errorComponent: ViewAsyncError,
    timeout: 15000,
  });
}

// `feed` is the cold-start view, so it is intentionally eager-imported — first
// paint should not flash a skeleton. The other four tabs are async so the
// initial bundle stays small.
const viewComponents: Record<AppViewKey, Component> = {
  feed: FeedView,
  map: asyncView(() => import("../features/map").then((m) => m.MapLeafletView)),
  publish: asyncView(() => import("../features/publish").then((m) => m.PublishView)),
  messages: asyncView(() => import("../features/messages").then((m) => m.MessagesView)),
  profile: asyncView(() => import("../features/profile").then((m) => m.ProfileView)),
  admin: asyncView(() => import("../features/admin").then((m) => m.AdminView)),
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});

const emit = defineEmits<{
  chrome: [payload: PageChromeSpec];
  close: [];
}>();
</script>

<template>
  <div class="app-view-host">
    <KeepAlive include="MapLeafletView">
      <component
        :is="viewComponents[props.activeViewKey]"
        @chrome="emit('chrome', $event)"
        @close="emit('close')"
      />
    </KeepAlive>
  </div>
</template>
