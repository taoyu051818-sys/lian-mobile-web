<script setup lang="ts">
import { AppViewKey, appViews } from "../app/view-types";
import { defineComponent, h } from "vue";
import { FeedPlaceholder } from "../views/FeedPlaceholder.vue";
import { MapPlaceholder } from "../views/MapPlaceholder.vue";
import { MessagesPlaceholder } from "../views/MessagesPlaceholder.vue";
import { ProfilePlaceholder } from "../views/ProfilePlaceholder.vue";

const viewComponents = {
  feed: FeedPlaceholder,
  map: MapPlaceholder,
  messages: MessagesPlaceholder,
  profile: ProfilePlaceholder,
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
