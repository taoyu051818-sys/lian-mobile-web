<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  RUNNER_BACK_TO_PROFILE,
  RUNNER_EMPTY_ACTIVE_BODY,
  RUNNER_EMPTY_ACTIVE_TITLE,
  RUNNER_EMPTY_AVAILABLE_BODY,
  RUNNER_EMPTY_AVAILABLE_TITLE,
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
import { LianButton } from "../../ui";
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

// Destructure so the template can read these refs without `.value` — Vue's
// auto-unwrap only applies to top-level refs returned from setup, not to
// nested keys on a returned object.
const {
  availableOrders,
  activeOrders,
  availableLoading,
  activeLoading,
  availableError,
  activeError,
  actionMessage,
  actionError,
  pendingActionFor,
  loadAvailable,
  loadActive,
  accept,
  markAtShop,
  markPickedUp,
  markDelivered,
  clearMessages,
} = useRunnerCenter();

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
  if (activeTab.value === key) return;
  activeTab.value = key;
  // Drop any prior tab's success/failure feedback so it doesn't haunt the
  // new tab — the message belongs to a transition that's no longer visible.
  clearMessages();
  if (key === "active") void loadActive();
  else void loadAvailable();
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

// Initial load is owned by this watcher: it fires both when the user record
// resolves to a runner-verified account on first mount AND when the user
// completes verification in another tab and comes back. onMounted only
// kicks the session refresh — it must NOT also call loadAvailable, otherwise
// we double-fetch on the happy path.
watch(isRunnerVerified, (verified) => {
  if (verified) {
    void loadAvailable();
  }
});

onMounted(async () => {
  emit("chrome", pageChrome.value);
  await refreshUser();
});
</script>

<template>
  <section class="runner-view" :aria-label="RUNNER_SECTION_LABEL">
    <p v-if="sessionLoading" class="runner-view__state" role="status">{{ RUNNER_LIST_LOADING }}</p>

    <RunnerGate v-else-if="!isRunnerVerified" data-testid="runner-gate" @go-verify="goVerify" />

    <template v-else>
      <p
        v-if="actionMessage || actionError"
        class="runner-view__feedback"
        :class="{ 'is-error': actionError }"
        role="status"
      >
        {{ actionError || actionMessage }}
      </p>

      <template v-if="activeTab === 'available'">
        <p
          v-if="availableLoading && !availableOrders.length"
          class="runner-view__state"
          role="status"
        >
          {{ RUNNER_LIST_LOADING }}
        </p>
        <div v-else-if="availableError" class="runner-view__error" role="alert">
          <span>{{ availableError }}</span>
          <LianButton variant="tonal" size="sm" @click="loadAvailable">
            {{ RUNNER_LIST_RELOAD }}
          </LianButton>
        </div>
        <section
          v-else-if="!availableOrders.length"
          class="runner-view__empty-card"
          data-testid="runner-empty-available"
        >
          <strong>{{ RUNNER_EMPTY_AVAILABLE_TITLE }}</strong>
          <p>{{ RUNNER_EMPTY_AVAILABLE_BODY }}</p>
        </section>
        <ul v-else class="runner-view__list" data-testid="runner-list-available">
          <li v-for="order in availableOrders" :key="order.id" class="runner-view__list-item">
            <RunnerOrderCard
              :order="order"
              :pending-action="pendingActionFor(order.id)"
              @accept="accept"
              @at-shop="markAtShop"
              @pickup="markPickedUp"
              @deliver="markDelivered"
            />
          </li>
        </ul>
      </template>

      <template v-else>
        <p v-if="activeLoading && !activeOrders.length" class="runner-view__state" role="status">
          {{ RUNNER_LIST_LOADING }}
        </p>
        <div v-else-if="activeError" class="runner-view__error" role="alert">
          <span>{{ activeError }}</span>
          <LianButton variant="tonal" size="sm" @click="loadActive">
            {{ RUNNER_LIST_RELOAD }}
          </LianButton>
        </div>
        <section
          v-else-if="!activeOrders.length"
          class="runner-view__empty-card"
          data-testid="runner-empty-active"
        >
          <strong>{{ RUNNER_EMPTY_ACTIVE_TITLE }}</strong>
          <p>{{ RUNNER_EMPTY_ACTIVE_BODY }}</p>
        </section>
        <ul v-else class="runner-view__list" data-testid="runner-list-active">
          <li v-for="order in activeOrders" :key="order.id" class="runner-view__list-item">
            <RunnerOrderCard
              :order="order"
              :pending-action="pendingActionFor(order.id)"
              @accept="accept"
              @at-shop="markAtShop"
              @pickup="markPickedUp"
              @deliver="markDelivered"
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

.runner-view__state {
  margin: 0;
  padding: var(--space-4) var(--space-3);
  text-align: center;
  color: var(--lian-muted);
  font-size: 14px;
}

.runner-view__empty-card {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-4) var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
  text-align: center;
}

.runner-view__empty-card strong {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.runner-view__empty-card p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.6;
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
  font-size: 13px;
  font-weight: 800;
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