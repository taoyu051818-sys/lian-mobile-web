<script setup lang="ts">
import { BottomTabBar, TopBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const { activeViewKey, activeView, setActiveView } = useActiveView();

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));
</script>

<template>
  <main class="vue-shell" aria-labelledby="vue-shell-title">
    <div class="vue-shell__grid">
      <TopBar
        title-id="vue-shell-title"
        :title="activeView.title"
        :subtitle="activeView.subtitle"
      />
      <AppViewHost :active-view-key="activeViewKey" />
      <BottomTabBar :items="tabs" :active-key="activeViewKey" @change="setActiveView" />
    </div>
  </main>
  <ToastHost />
</template>
