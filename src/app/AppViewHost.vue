<script setup lang="ts">
import type { AppViewKey } from "./view-types";
import type { PropType } from "vue";
import FeedView from "../views/FeedView.vue";
import MapView from "../views/MapView.vue";
import MessagesView from "../views/MessagesView.vue";
import ProfileView from "../views/ProfileView.vue";

const viewComponents = {
  feed: FeedView,
  map: MapView,
  messages: MessagesView,
  profile: ProfileView,
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});
</script>

<template>
  <div class="app-view-host">
    <component :is="viewComponents[props.activeViewKey]" />
  </div>
</template>
