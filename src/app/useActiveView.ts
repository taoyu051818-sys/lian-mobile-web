import { computed, ref } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";

const activeViewKey = ref<AppViewKey>("feed");

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(activeViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (!appViews.some((view) => view.key === key)) return;
    activeViewKey.value = key;
  }

  return {
    activeViewKey,
    activeView,
    views: appViews,
    setActiveView
  };
}
