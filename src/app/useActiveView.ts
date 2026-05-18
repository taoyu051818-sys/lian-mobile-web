import { computed, ref } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";

const activeViewKey = ref<AppViewKey>("feed");
const SECRET_VIEWS: AppViewKey[] = ["admin"];

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(activeViewKey.value));

  function setActiveView(key: AppViewKey) {
    if (appViews.some((view) => view.key === key)) {
      activeViewKey.value = key;
      return;
    }
    if (SECRET_VIEWS.includes(key)) {
      activeViewKey.value = key;
    }
  }

  return {
    activeViewKey,
    activeView,
    views: appViews,
    setActiveView,
  };
}
