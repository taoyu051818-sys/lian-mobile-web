<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  RUNNER_BACK_TO_PROFILE,
  RUNNER_LIST_EMPTY_ACTIVE,
  RUNNER_LIST_EMPTY_AVAILABLE,
  RUNNER_LIST_LOADING,
  RUNNER_LIST_RELOAD,
  RUNNER_SECTION_LABEL,
  RUNNER_TAB_ACTIVE,
  RUNNER_TAB_AVAILABLE,
  RUNNER_TAB_LABEL,
} from "../../config/brand";
import { fetchAuthMe } from "../../api/profile";
import { useActiveView } from "../../app/useActiveView";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import RunnerGate from "./RunnerGate.vue";
import RunnerOrderCard from "./RunnerOrderCard.vue";
import { useIsRunnerVerified, useRunnerCenter, type RunnerCenterTab } from "./useRunnerCenter";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const { setActiveView } = useActiveView();

const user = ref<ProfileUser | null>(null);
const sessionLoading = ref(false);
const sessionError = ref("");

const isRunnerVerified = useIsRunnerVerified(user);

const runner = useRunnerCenter();
const activeTab = ref<RunnerCenterTab>("available");

const tabs: Array<{ key: RunnerCenterTab; label: string }> = [
  { key: "available", label: RUNNER_TAB_AVAILABLE },
  { key: "active", label: RUNNER_TAB_ACTIVE },
];

const pageChrome = computed<PageChromeSpec>(() => {
  if (!isRunnerVerified.value) {
    return {
      top: {
        visible: true,
        identity: { avatarText: "跑", name: RUNNER_SECTION_LABEL },
        buttons: [{ id: "runner:close", label: RUNNER_BACK_TO_PROFILE, variant: "ghost" }],
        onButtonClick: handleChromeButtonClick,
      },
    };
  }
  return {
    top: {
      visible: true,
      identity: { avatarText: "跑", name: RUNNER_SECTION_LABEL },
      tabs: {
        kind: "tabs",
        items: tabs.map((t) => ({ id: t.key, label: t.label })),
        activeKey: activeTab.value,
        ariaLabel: RUNNER_TAB_LABEL,
      },
      buttons: [{ id: "runner:close", label: RUNNER_BACK_TO_PROFILE, variant: "ghost" }],
      onTabSelect: (id) => selectTab(id as RunnerCenterTab),
      onButtonClick: handleChromeButtonClick,
    },
  };
});

function handleChromeButtonClick(buttonId: string) {
  if (buttonId === "runner:close") emit("close");
}

function selectTab(key: RunnerCenterTab) {
  activeTab.value = key;
  if (key === "active") void runner.loadActive();
  else void runner.loadAvailable();
}

async function refreshUser() {
  sessionLoading.value = true;
  sessionError.value = "";
  try {
    user.value = await fetchAuthMe();
  } catch {
    // Silent: gate will render with isRunnerVerified === false; the user
    // can return to the profile via the back button.
    user.value = null;
  } finally {
    sessionLoading.value = false;
  }
}

function goVerify() {
  setActiveView("verification");
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

watch(isRunnerVerified, (verified) => {
  if (verified) {
    void runner.loadAvailable();
  }
});

onMounted(async () => {
  emit("chrome", pageChrome.value);
  await refreshUser();
  if (isRunnerVerified.value) {
    await runner.loadAvailable();
  }
});
</script>

<template>
  <section class="runner-view" :aria-label="RUNNER_SECTION_LABEL">
    <p v-if="sessionLoading" class="runner-view__state" role="status">{{ RUNNER_LIST_LOADING }}</p>

    <RunnerGate v-else-if="!isRunnerVerified" data-testid="runner-gate" @go-verify="goVerify" />

    <template v-else>
      <p
        v-if="runner.actionMessage.value || runner.actionError.value"
        class="runner-view__feedback"
        :class="{ 'is-error': runner.actionError.value }"
        role="status"
      >
        {{ runner.actionError.value || runner.actionMessage.value }}
      </p>

      <template v-if="activeTab === 'available'">
        <p
          v-if="runner.availableLoading.value && !runner.availableOrders.value.length"
          class="runner-view__state"
          role="status"
        >
          {{ RUNNER_LIST_LOADING }}
        </p>
        <div v-else-if="runner.availableError.value" class="runner-view__error" role="alert">
          {{ runner.availableError.value }}
          <button type="button" @click="runner.loadAvailable">{{ RUNNER_LIST_RELOAD }}</button>
        </div>
        <p
          v-else-if="!runner.availableOrders.value.length"
          class="runner-view__empty"
          data-testid="runner-empty-available"
        >
          {{ RUNNER_LIST_EMPTY_AVAILABLE }}
        </p>
        <ul v-else class="runner-view__list" data-testid="runner-list-available">
          <li
            v-for="order in runner.availableOrders.value"
            :key="order.id"
            class="runner-view__list-item"
          >
            <RunnerOrderCard
              :order="order"
              :pending-action="runner.pendingActionFor(order.id)"
              @accept="runner.accept"
              @at-shop="runner.markAtShop"
              @pickup="runner.markPickedUp"
              @deliver="runner.markDelivered"
            />
          </li>
        </ul>
      </template>

      <template v-else>
        <p
          v-if="runner.activeLoading.value && !runner.activeOrders.value.length"
          class="runner-view__state"
          role="status"
        >
          {{ RUNNER_LIST_LOADING }}
        </p>
        <div v-else-if="runner.activeError.value" class="runner-view__error" role="alert">
          {{ runner.activeError.value }}
          <button type="button" @click="runner.loadActive">{{ RUNNER_LIST_RELOAD }}</button>
        </div>
        <p
          v-else-if="!runner.activeOrders.value.length"
          class="runner-view__empty"
          data-testid="runner-empty-active"
        >
          {{ RUNNER_LIST_EMPTY_ACTIVE }}
        </p>
        <ul v-else class="runner-view__list" data-testid="runner-list-active">
          <li
            v-for="order in runner.activeOrders.value"
            :key="order.id"
            class="runner-view__list-item"
          >
            <RunnerOrderCard
              :order="order"
              :pending-action="runner.pendingActionFor(order.id)"
              @accept="runner.accept"
              @at-shop="runner.markAtShop"
              @pickup="runner.markPickedUp"
              @deliver="runner.markDelivered"
            />
          </li>
        </ul>
      </template>
    </template>

    <p v-if="sessionError" class="runner-view__error" role="alert">{{ sessionError }}</p>
  </section>
</template>

<style scoped>
.runner-view {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.runner-view__state,
.runner-view__empty {
  margin: 0;
  padding: var(--space-4) var(--space-3);
  text-align: center;
  color: var(--lian-muted);
  font-size: 14px;
}

.runner-view__feedback {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 800;
}

.runner-view__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.runner-view__error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
  font-size: 13px;
  font-weight: 800;
}

.runner-view__error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}

.runner-view__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.runner-view__list-item {
  list-style: none;
}
</style>
