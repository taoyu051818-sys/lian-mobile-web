<script setup lang="ts">
import { ref } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const { activeViewKey, setActiveView } = useActiveView();
const chromeHidden = ref(false);

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function handleViewChange(key: string) {
  chromeHidden.value = false;
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}
</script>

<template>
  <main class="vue-shell" aria-label="LIAN 主内容">
    <div class="vue-shell__grid">
      <AppViewHost :active-view-key="activeViewKey" @chrome="chromeHidden = $event" />
      <BottomTabBar
        class="vue-shell__bottom-tab lian-floating-chrome lian-floating-chrome--bottom"
        :class="{ 'is-hidden': chromeHidden }"
        data-floating-chrome="bottom"
        :data-floating-state="chromeHidden ? 'hidden' : 'visible'"
        :items="tabs"
        :active-key="activeViewKey"
        @change="handleViewChange"
      />
    </div>
  </main>
  <ToastHost />
</template>
