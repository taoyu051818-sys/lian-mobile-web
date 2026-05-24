<script setup lang="ts">
import { ToastHost, ErrorBoundary } from "./ui";
import PwaBanner from "./ui/feedback/PwaBanner.vue";
import AppViewHost from "./app/AppViewHost.vue";
import DetailSurface from "./app/DetailSurface.vue";
import { AppShell } from "./shell";
import { appViews, getShellLayoutMode, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const { activeViewKey, setActiveView } = useActiveView();

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function handleViewChange(key: string) {
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}
</script>

<template>
  <ErrorBoundary>
    <AppShell
      :active-view-key="activeViewKey"
      :layout-mode="getShellLayoutMode(activeViewKey)"
      :tabs="tabs"
      @view-change="handleViewChange"
    >
      <template #default="{ onChrome }">
        <AppViewHost
          :active-view-key="activeViewKey"
          @chrome="onChrome"
          @close="setActiveView('profile')"
        />
      </template>
    </AppShell>
    <DetailSurface />
  </ErrorBoundary>
  <ToastHost />
  <PwaBanner />
</template>
