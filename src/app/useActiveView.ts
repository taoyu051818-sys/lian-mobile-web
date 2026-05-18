import { computed } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";
import { getDetailTidRef, getViewFromHashRef, pushViewHash } from "./useDeepLink";

const detailTid = getDetailTidRef();
const viewFromHash = getViewFromHashRef();

// Detail panel lives inside FeedView, so a `#/post/{tid}` deep link must
// resolve to the feed tab regardless of whatever else was active.
const effectiveActiveViewKey = computed<AppViewKey>(() =>
  detailTid.value !== null ? "feed" : viewFromHash.value,
);

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(effectiveActiveViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (!appViews.some((view) => view.key === key)) return;
    // Source of truth is the URL hash. pushViewHash also clears any in-flight
    // detailTid so opening a different tab while the post detail is open
    // closes the detail (FeedView's detailTid watch handles the panel
    // teardown).
    pushViewHash(key);
  }

  return {
    activeViewKey: effectiveActiveViewKey,
    activeView,
    views: appViews,
    setActiveView,
  };
}
