<script setup lang="ts">
/**
 * Merchant center (issue #646).
 *
 * Routing:
 *   - secret view "merchant" — only reachable via setActiveView("merchant")
 *     after a `merchant_verified` user enters from ProfileView (or a future
 *     entry button). Hash deep-link is intentionally absent: refreshing the
 *     page returns the user to the feed.
 *
 * Gate vs center:
 *   - When /api/me/merchant-center reports `merchantVerified=false`, this
 *     view shows the gate (CTA to verification center). The gate is the
 *     same component used everywhere else so the UX stays consistent.
 *   - When verified, the view renders the merchant profile readout plus the
 *     errand-eligibility chip (read-only — order state machine is #647/#648).
 *
 * Loading state:
 *   - We branch on `loaded` rather than `loading`: the gate path requires a
 *     successful round-trip first so the user is never flashed the gate while
 *     the snapshot is still in flight.
 */
import { computed, onMounted, watch } from "vue";
import { LianButton } from "../../ui";
import { useActiveView } from "../../app/useActiveView";
import {
  MERCHANT_CENTER_BACK_TO_PROFILE,
  MERCHANT_CENTER_ERRAND_AVAILABLE,
  MERCHANT_CENTER_ERRAND_TITLE,
  MERCHANT_CENTER_ERRAND_UNAVAILABLE,
  MERCHANT_CENTER_LOADING,
  MERCHANT_CENTER_PROFILE_CATEGORY_LABEL,
  MERCHANT_CENTER_PROFILE_CONTACT_LABEL,
  MERCHANT_CENTER_PROFILE_HOURS_LABEL,
  MERCHANT_CENTER_PROFILE_NAME_LABEL,
  MERCHANT_CENTER_PROFILE_TITLE,
  MERCHANT_CENTER_PROFILE_VERIFIED_AT,
  MERCHANT_CENTER_RELOAD,
  MERCHANT_CENTER_SECTION_LABEL,
  MERCHANT_CONTACT_UNSET,
  MERCHANT_HOURS_UNSET,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import MerchantCenterGate from "./MerchantCenterGate.vue";
import { categoryLabel, errandReasonText, formatVerifiedAt } from "./merchant-format";
import { useMerchantCenter } from "./useMerchantCenter";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const center = useMerchantCenter();
const { setActiveView } = useActiveView();

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

const hoursLabel = computed(() => center.profile.value?.hours || MERCHANT_HOURS_UNSET);
const contactLabel = computed(() => center.profile.value?.contact || MERCHANT_CONTACT_UNSET);
const verifiedAt = computed(() => formatVerifiedAt(center.profile.value?.verifiedAt));
const errandReason = computed(() => errandReasonText(center.errand.value));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void center.refresh();
});
</script>

<template>
  <section class="merchant-center" :aria-label="MERCHANT_CENTER_SECTION_LABEL">
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

    <MerchantCenterGate
      v-else-if="!center.merchantVerified.value"
      block
      data-testid="merchant-center-gate-host"
      @go-verify="goVerify"
    />

    <template v-else>
      <section class="merchant-center__profile" :aria-label="MERCHANT_CENTER_PROFILE_TITLE">
        <header class="merchant-center__heading">
          <h2>{{ MERCHANT_CENTER_PROFILE_TITLE }}</h2>
          <p v-if="verifiedAt" class="merchant-center__verified-at">
            {{ MERCHANT_CENTER_PROFILE_VERIFIED_AT }} {{ verifiedAt }}
          </p>
        </header>

        <dl class="merchant-center__profile-rows" data-testid="merchant-center-profile">
          <div class="merchant-center__row">
            <dt>{{ MERCHANT_CENTER_PROFILE_NAME_LABEL }}</dt>
            <dd data-testid="merchant-center-profile-name">{{ center.profile.value?.name }}</dd>
          </div>
          <div class="merchant-center__row">
            <dt>{{ MERCHANT_CENTER_PROFILE_CATEGORY_LABEL }}</dt>
            <dd>{{ categoryLabel(center.profile.value!.category) }}</dd>
          </div>
          <div class="merchant-center__row">
            <dt>{{ MERCHANT_CENTER_PROFILE_HOURS_LABEL }}</dt>
            <dd>{{ hoursLabel }}</dd>
          </div>
          <div class="merchant-center__row">
            <dt>{{ MERCHANT_CENTER_PROFILE_CONTACT_LABEL }}</dt>
            <dd>{{ contactLabel }}</dd>
          </div>
        </dl>
      </section>

      <section
        class="merchant-center__errand"
        :aria-label="MERCHANT_CENTER_ERRAND_TITLE"
        data-testid="merchant-center-errand"
      >
        <header class="merchant-center__heading">
          <h3>{{ MERCHANT_CENTER_ERRAND_TITLE }}</h3>
          <span
            class="merchant-center__errand-status"
            :class="{ 'is-available': center.errand.value.available }"
            :data-available="center.errand.value.available ? 'true' : 'false'"
            data-testid="merchant-center-errand-status"
          >
            {{
              center.errand.value.available
                ? MERCHANT_CENTER_ERRAND_AVAILABLE
                : MERCHANT_CENTER_ERRAND_UNAVAILABLE
            }}
          </span>
        </header>

        <p
          v-if="!center.errand.value.available"
          class="merchant-center__errand-reason"
          data-testid="merchant-center-errand-reason"
        >
          {{ errandReason }}
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.merchant-center {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.merchant-center__state {
  display: grid;
  min-height: 96px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
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

.merchant-center__profile,
.merchant-center__errand {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.merchant-center__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.merchant-center__heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.merchant-center__heading h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.merchant-center__verified-at {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.merchant-center__profile-rows {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.merchant-center__row {
  display: grid;
  grid-template-columns: 6em 1fr;
  gap: var(--space-2);
}

.merchant-center__row dt {
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 700;
}

.merchant-center__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 700;
}

.merchant-center__errand-status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(120, 120, 120, 0.18);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.merchant-center__errand-status.is-available {
  background: rgba(31, 167, 160, 0.16);
  color: #1a6f6c;
}

.merchant-center__errand-reason {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
