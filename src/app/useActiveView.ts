import { computed, ref, watch } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";
import { getDetailTidRef, getViewFromHashRef, pushViewHash } from "./useDeepLink";

const SECRET_VIEWS: AppViewKey[] = ["admin"];
const detailTid = getDetailTidRef();
const viewFromHash = getViewFromHashRef();
const secretActiveViewKey = ref<AppViewKey | null>(null);

// Detail panel lives inside FeedView, so a `#/post/{tid}` deep link must
// resolve to the feed tab regardless of whatever else was active.
const effectiveActiveViewKey = computed<AppViewKey>(() =>
  detailTid.value !== null ? "feed" : (secretActiveViewKey.value ?? viewFromHash.value),
);

watch(viewFromHash, () => {
  secretActiveViewKey.value = null;
});

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(effectiveActiveViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (appViews.some((view) => view.key === key)) {
      secretActiveViewKey.value = null;
      // Source of truth is the URL hash. pushViewHash also clears any in-flight
      // detailTid so opening a different tab while the post detail is open
      // closes the detail (FeedView's detailTid watch handles the panel
      // teardown).
      pushViewHash(key);
      return;
    }
    if (SECRET_VIEWS.includes(key)) {
      secretActiveViewKey.value = key;
    }
  }

  return {
    activeViewKey: effectiveActiveViewKey,
    activeView,
    views: appViews,
    setActiveView,
  };
}
