import { computed, ref, watch } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";
import { getViewFromHashRef, pushViewHash } from "./view-hash";

const SECRET_VIEWS: AppViewKey[] = [
  "admin",
  "verification",
  "merchant",
  "errand-order",
  "runner",
];
const viewFromHash = getViewFromHashRef();
const secretActiveViewKey = ref<AppViewKey | null>(null);

// Active view is independent of the detail-navigation FSM. Post detail is now
// an App-level overlay (see src/app/DetailSurface.vue, issue #636), so opening
// or closing a detail must not move the user off whichever tab they're on.
const effectiveActiveViewKey = computed<AppViewKey>(
  () => secretActiveViewKey.value ?? viewFromHash.value,
);

watch(viewFromHash, () => {
  secretActiveViewKey.value = null;
});

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(effectiveActiveViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (appViews.some((view) => view.key === key)) {
      secretActiveViewKey.value = null;
      // URL is the source of truth. The view hash is the only writer here —
      // a separate detail-navigation/url-sync listener will close any open
      // post-detail overlay when this hashchange lands.
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
