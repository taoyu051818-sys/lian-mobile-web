import { computed, ref } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";
import { getDetailTidRef } from "./useDeepLink";

const activeViewKey = ref<AppViewKey>("feed");
const detailTid = getDetailTidRef();

// Detail panel lives inside FeedView, so a `#/post/{tid}` deep link must
// resolve to the feed tab regardless of whatever else was active.
const effectiveActiveViewKey = computed<AppViewKey>(() =>
  detailTid.value !== null ? "feed" : activeViewKey.value,
);

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(effectiveActiveViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (!appViews.some((view) => view.key === key)) return;
    activeViewKey.value = key;
  }

  return {
    activeViewKey: effectiveActiveViewKey,
    activeView,
    views: appViews,
    setActiveView,
  };
}
