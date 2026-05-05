<script setup lang="ts">
import { BottomTabBar, TopBar, ToastHost, useToast } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const toast = useToast();
const { activeViewKey, setActiveView } = useActiveView();

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));
</script>

<template>
  <main class="vue-shell" aria-labelledby="vue-shell-title">
    <div class="vue-shell__grid">
      <TopBar title="探索" subtitle="地点组织沉淀，地图负责定位" />
      <AppViewHost :activeViewKey="activeViewKey" />
      <BottomTabBar :items="tabs" :active-key="activeViewKey" @change="setActiveView" />
    </div>
  </main>
  <ToastHost />
</template>
