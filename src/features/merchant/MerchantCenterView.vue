<script setup lang="ts">
/**
 * Merchant center (issue #646).
 *
 * Routing:
 *   - Reachable as the secret view "merchant" via setActiveView("merchant")
 *     from ProfileView (the entry button is gated on merchant_verified) and
 *     via direct hash deep-link `#/merchant`. The hash path is included so
 *     the gate-vs-list branch can be exercised from a URL.
 *
 * Identity gate:
 *   - Identity comes from `useMerchantCenter`, which owns the /api/auth/me
 *     round-trip and exposes the merchant_verified gate via
 *     `useIsMerchantVerified`. When the user is not verified, the view
 *     renders the gate component which routes to the verification center.
 *     The view never silently renders an empty list for non-merchant users.
 *
 * Data:
 *   - Reuses `GET /api/me/posts` and filters client-side to merchant items
 *     (presentationIntent === "merchant" / contentType merchant_* / inline
 *     merchant block). No new backend route is introduced.
 */
import { computed, onMounted, watch } from "vue";
import { LianButton } from "../../ui";
import { useActiveView } from "../../app/useActiveView";
import { useDetailNavigation } from "../../app/detail-navigation";
import {
  MERCHANT_CENTER_BACK_TO_PROFILE,
  MERCHANT_CENTER_EMPTY_HEADLINE,
  MERCHANT_CENTER_EMPTY_HINT,
  MERCHANT_CENTER_ERRAND_AVAILABLE,
  MERCHANT_CENTER_ERRAND_UNAVAILABLE,
  MERCHANT_CENTER_HOURS_LABEL,
  MERCHANT_CENTER_LOADING,
  MERCHANT_CENTER_OPEN_DETAIL,
  MERCHANT_CENTER_POSTS_TITLE,
  MERCHANT_CENTER_RELOAD,
  MERCHANT_CENTER_SECTION_LABEL,
  MERCHANT_HOURS_UNSET,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import MerchantCenterGate from "./MerchantCenterGate.vue";
import { useMerchantCenter } from "./useMerchantCenter";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const center = useMerchantCenter();
const { setActiveView } = useActiveView();
const detail = useDetailNavigation();

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    visible: true,
    identity: { avatarText: "商", name: MERCHANT_CENTER_SECTION_LABEL },
    buttons: [{ id: "merchant:close", label: MERCHANT_CENTER_BACK_TO_PROFILE, variant: "ghost" }],
    onButtonClick: (id) => {
      if (id === "merchant:close") emit("close");
    },
  },
}));

function goVerify() {
  setActiveView("verification");
}

function openPost(tid: number) {
  detail.open(tid, "card");
}

function hoursLabel(hours: string) {
  return hours || MERCHANT_HOURS_UNSET;
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(async () => {
  emit("chrome", pageChrome.value);
  // Refresh /api/auth/me so the gate decision matches the freshest verification
  // state, then load the merchant post list when the gate is open. The
  // composable short-circuits the post fetch when the gate is closed.
  await center.refreshSession();
  if (center.isMerchantVerified.value) {
    void center.refresh();
  }
});

watch(center.isMerchantVerified, (verified) => {
  if (verified && !center.loaded.value && !center.loading.value) {
    void center.refresh();
  }
});
</script>

<template>
  <section class="merchant-center" :aria-label="MERCHANT_CENTER_SECTION_LABEL">
    <MerchantCenterGate
      v-if="!center.isMerchantVerified.value"
      block
      data-testid="merchant-center-gate-host"
      @go-verify="goVerify"
    />

    <template v-else>
      <header class="merchant-center__header">
        <h2>{{ MERCHANT_CENTER_POSTS_TITLE }}</h2>
      </header>

      <div
        v-if="center.loading.value && !center.loaded.value"
        class="merchant-center__state"
        role="status"
        data-testid="merchant-center-loading"
      >
        {{ MERCHANT_CENTER_LOADING }}
      </div>

      <p
        v-else-if="center.errorMessage.value && !center.loaded.value"
        class="merchant-center__feedback is-error"
        role="alert"
        data-testid="merchant-center-error"
      >
        {{ center.errorMessage.value }}
        <LianButton size="sm" variant="ghost" @click="() => void center.refresh()">{{
          MERCHANT_CENTER_RELOAD
        }}</LianButton>
      </p>

      <p
        v-else-if="!center.posts.value.length"
        class="merchant-center__state"
        data-testid="merchant-center-empty"
      >
        <strong>{{ MERCHANT_CENTER_EMPTY_HEADLINE }}</strong>
        <span class="merchant-center__hint">{{ MERCHANT_CENTER_EMPTY_HINT }}</span>
      </p>

      <ul v-else class="merchant-center__list" data-testid="merchant-center-list">
        <li
          v-for="post in center.posts.value"
          :key="post.tid"
          class="merchant-center__row"
          :data-testid="`merchant-center-row-${post.tid}`"
        >
          <div class="merchant-center__row-copy">
            <strong class="merchant-center__row-title">{{ post.title }}</strong>
            <span class="merchant-center__row-meta">
              {{ MERCHANT_CENTER_HOURS_LABEL }} {{ hoursLabel(post.hours) }}
            </span>
            <span
              class="merchant-center__row-errand"
              :data-available="post.errandSupported ? 'true' : 'false'"
              :data-testid="`merchant-center-errand-${post.tid}`"
            >
              {{
                post.errandSupported
                  ? MERCHANT_CENTER_ERRAND_AVAILABLE
                  : MERCHANT_CENTER_ERRAND_UNAVAILABLE
              }}
            </span>
          </div>
          <button
            type="button"
            class="merchant-center__row-cta"
            :data-testid="`merchant-center-open-${post.tid}`"
            @click="openPost(post.tid)"
          >
            {{ MERCHANT_CENTER_OPEN_DETAIL }}
          </button>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.merchant-center {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.merchant-center__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.merchant-center__state {
  display: grid;
  gap: var(--space-1);
  min-height: 96px;
  place-content: center;
  text-align: center;
  color: var(--lian-muted);
}

.merchant-center__state strong {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
}

.merchant-center__hint {
  font-size: 12px;
  line-height: 1.5;
}

.merchant-center__feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 800;
}

.merchant-center__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.merchant-center__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.merchant-center__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.merchant-center__row-copy {
  display: grid;
  gap: 4px;
  flex: 1 1 200px;
}

.merchant-center__row-title {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
  line-height: 1.3;
}

.merchant-center__row-meta {
  color: var(--lian-muted);
  font-size: 13px;
}

.merchant-center__row-errand {
  align-self: start;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(120, 120, 120, 0.18);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.merchant-center__row-errand[data-available="true"] {
  background: rgba(31, 167, 160, 0.16);
  color: #1a6f6c;
}

.merchant-center__row-cta {
  flex: none;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--lian-primary, #1fa7a0);
  color: #fff;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}
</style>
