<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
  type PropType,
} from "vue";
import type { AppViewKey } from "./view-types";
import type { PageChromeSpec } from "../shell/page-model";
import { FeedView } from "../features/feed";
import { parseDeepLink, parseDeepLinkQuery } from "./deepLink";
import { registerBeforeNavigate } from "./view-hash";
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
  map: asyncView(() => import("../features/map").then((m) => m.MapView)),
  publish: asyncView(() => import("../features/publish").then((m) => m.PublishView)),
  messages: asyncView(() => import("../features/messages").then((m) => m.MessagesView)),
  profile: asyncView(() => import("../features/profile").then((m) => m.ProfileView)),
  admin: asyncView(() => import("../features/admin").then((m) => m.AdminView)),
  verification: asyncView(() => import("../features/verification").then((m) => m.VerificationView)),
  merchant: asyncView(() => import("../features/merchant").then((m) => m.MerchantCenterView)),
  "errand-order": asyncView(() => import("../features/errand").then((m) => m.ErrandOrderView)),
  runner: asyncView(() => import("../features/runner").then((m) => m.RunnerCenterView)),
  commerce: asyncView(() => import("../features/commerce").then((m) => m.CommerceView)),
};

const props = defineProps({
  activeViewKey: { type: String as PropType<AppViewKey>, required: true },
});

const emit = defineEmits<{
  chrome: [payload: PageChromeSpec];
  close: [];
}>();

const publishPickerLease = ref(false);
let unregisterBeforeNavigate: (() => void) | null = null;
const shouldKeepPublishAlive = computed(
  () => props.activeViewKey === "publish" || publishPickerLease.value,
);

function openPublishMapPicker() {
  if (props.activeViewKey === "publish") publishPickerLease.value = true;
}

watch(
  () => props.activeViewKey,
  (nextView) => {
    if (nextView !== "map") publishPickerLease.value = false;
  },
);

// A hash-only transition from `#/map?picker=1` to regular `#/map` does not
// change activeViewKey. Release only for that same-view exit; cross-view
// navigation is left to the prop watcher so the Publish cache cannot be
// pruned before the parent has applied its new active view.
function releasePublishLeaseOnMapExit() {
  if (!publishPickerLease.value || typeof window === "undefined") return;
  const hash = window.location.hash;
  const link = parseDeepLink(hash);
  if (link?.view !== "map") return;
  if (parseDeepLinkQuery(hash).picker !== "1") {
    publishPickerLease.value = false;
  }
}

// In-app tab navigation uses history.pushState, which intentionally emits
// neither hashchange nor popstate. The before-navigate hook closes the one
// same-view gap: picker -> the regular Map tab while activeViewKey stays map.
// Other target views remain owned by the prop watcher so Publish cannot be
// pruned before the parent applies a return to the active Publish view.
function releasePublishLeaseOnInAppMapNavigation(target: AppViewKey) {
  if (
    !publishPickerLease.value ||
    props.activeViewKey !== "map" ||
    target !== "map" ||
    typeof window === "undefined" ||
    parseDeepLinkQuery(window.location.hash).picker !== "1"
  ) {
    return;
  }
  publishPickerLease.value = false;
}

onMounted(() => {
  if (typeof window === "undefined") return;
  unregisterBeforeNavigate = registerBeforeNavigate(releasePublishLeaseOnInAppMapNavigation);
  window.addEventListener("hashchange", releasePublishLeaseOnMapExit);
  window.addEventListener("popstate", releasePublishLeaseOnMapExit);
});

onUnmounted(() => {
  unregisterBeforeNavigate?.();
  unregisterBeforeNavigate = null;
  if (typeof window === "undefined") return;
  window.removeEventListener("hashchange", releasePublishLeaseOnMapExit);
  window.removeEventListener("popstate", releasePublishLeaseOnMapExit);
});
</script>

<template>
  <div class="app-view-host">
    <KeepAlive include="MapView">
      <component
        :is="viewComponents.map"
        v-if="props.activeViewKey === 'map'"
        @chrome="emit('chrome', $event)"
        @close="emit('close')"
      />
    </KeepAlive>
    <KeepAlive v-if="shouldKeepPublishAlive" include="PublishView">
      <component
        :is="viewComponents.publish"
        v-if="props.activeViewKey === 'publish'"
        @chrome="emit('chrome', $event)"
        @close="emit('close')"
        @map-picker-open="openPublishMapPicker"
      />
    </KeepAlive>
    <component
      :is="viewComponents[props.activeViewKey]"
      v-if="props.activeViewKey !== 'map' && props.activeViewKey !== 'publish'"
      @chrome="emit('chrome', $event)"
      @close="emit('close')"
    />
  </div>
</template>
