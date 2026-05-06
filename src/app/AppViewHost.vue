<script setup lang="ts">
import type { AppViewKey } from "./view-types";
import type { PropType } from "vue";
import FeedView from "../views/FeedView.vue";
import MapView from "../views/MapView.vue";
import MessagesView from "../views/MessagesView.vue";
import ProfileView from "../views/ProfileView.vue";
import PublishView from "../views/PublishView.vue";

export type ChromeStatePayload = boolean | {
  hidden?: boolean;
  progress?: number;
};

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
  chrome: [payload: ChromeStatePayload];
}>();
</script>

<template>
  <div class="app-view-host">
    <component :is="viewComponents[props.activeViewKey]" @chrome="emit('chrome', $event)" />
  </div>
</template>
