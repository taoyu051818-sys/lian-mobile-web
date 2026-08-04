<script setup lang="ts">
/**
 * Merchant detail block (PRD V0.1 §10).
 *
 * Renders the merchant extension on the post detail panel: category pill,
 * verification stamp, hours/contact rows, and an errand CTA when the
 * publisher opted in. The CTA derives its 6-state visual + ARIA contract
 * from `DetailCtaButton` (Apple-gap wave 3-A / mw#827) so any cross-CTA
 * polish lands here in one place. The state machine itself lives in
 * `useErrandHelpCta`, which the block treats as a black-box selector.
 */
import { computed, toRef } from "vue";
import { useDetailNavigation } from "../../app/detail-navigation";
import { useActiveView } from "../../app/useActiveView";
import {
  MERCHANT_BLOCK_LABEL,
  MERCHANT_CATEGORY_FOOD,
  MERCHANT_CATEGORY_LABEL,
  MERCHANT_CATEGORY_RETAIL,
  MERCHANT_CATEGORY_SERVICE,
  MERCHANT_CONTACT_LABEL,
  MERCHANT_CONTACT_UNSET,
  MERCHANT_ERRAND_AVAILABLE,
  MERCHANT_ERRAND_CTA,
  MERCHANT_ERRAND_HINT,
  MERCHANT_ERRAND_PERMISSION_BLOCKED_HINT,
  MERCHANT_ERRAND_PERMISSION_BLOCKED_TITLE,
  MERCHANT_ERRAND_UNAVAILABLE_FALLBACK,
  MERCHANT_ERRAND_UNAVAILABLE_LABEL,
  MERCHANT_HOURS_LABEL,
  MERCHANT_HOURS_UNSET,
  MERCHANT_VERIFIED_AT_PREFIX,
  MERCHANT_VERIFIED_PREFIX,
} from "../../config/brand";
import type { MerchantErrandUnavailableReason } from "../../types/merchant";
import type { MerchantCategory, MerchantPostExtension } from "../../types/post-extensions";
import { errandReasonText } from "../merchant/merchant-format";
import { useErrandHelpCta } from "../merchant/useErrandHelpCta";
import DetailCtaButton from "./DetailCtaButton.vue";
// Import directly from the route module instead of `../errand` so the detail
// chunk doesn't statically pull the heavy ErrandOrder*View SFCs from the
// barrel — those SFCs are async-mounted by AppViewHost and should stay out
// of the detail bundle.
import { useErrandOrderRoute } from "../errand/useErrandOrderRoute";

const props = withDefaults(
  defineProps<{
    merchant: MerchantPostExtension;
    errandEntryAvailable?: boolean;
    merchantPostId?: number;
    errandUnavailableReason?: MerchantErrandUnavailableReason | "";
    errandUnavailableReasonText?: string;
    showErrandAction?: boolean;
    /**
     * Wave 3-A capability gate (mw#827). When the parent surface knows the
     * viewer can't actually place an errand order (e.g. anonymous viewer,
     * not yet campus_verified), pass `false`. The CTA stays mounted so the
     * journey is still visible, but the button renders in the
     * `disabled-permission` state — muted tone, aria-disabled="true",
     * `title` carrying the reason, and clicks suppressed. Default `true`
     * preserves the legacy behavior so callers that have not opted into
     * the gate yet keep working byte-identically.
     */
    viewerCanOrderErrand?: boolean;
  }>(),
  {
    errandEntryAvailable: undefined,
    merchantPostId: undefined,
    errandUnavailableReason: "",
    errandUnavailableReasonText: "",
    showErrandAction: undefined,
    viewerCanOrderErrand: true,
  },
);

const CATEGORY_LABEL: Record<MerchantCategory, string> = {
  food: MERCHANT_CATEGORY_FOOD,
  service: MERCHANT_CATEGORY_SERVICE,
  retail: MERCHANT_CATEGORY_RETAIL,
};

const categoryLabel = computed(() => CATEGORY_LABEL[props.merchant.category]);
const hoursLabel = computed(() => props.merchant.hours || MERCHANT_HOURS_UNSET);
const contactLabel = computed(() => props.merchant.contact || MERCHANT_CONTACT_UNSET);

const verifiedAtLabel = computed(() => {
  const raw = props.merchant.verifiedAt;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${MERCHANT_VERIFIED_AT_PREFIX} ${yyyy}-${mm}-${dd}`;
});

// `errandEntryAvailable === false` is the unavailable case (the merchant
// supports errand but it's currently turned off). `undefined` means the
// merchant does not support errand at all — we render nothing in that case
// so non-errand merchants don't grow a "暂未开放" chip.
const errandUnavailable = computed(() => props.errandEntryAvailable === false);
const showErrandEntry = computed(
  () => props.showErrandAction ?? props.errandEntryAvailable === true,
);
const errandRoute = useErrandOrderRoute();
const { setActiveView } = useActiveView();
const detail = useDetailNavigation();

const unavailableReasonLabel = computed(() => {
  if (!errandUnavailable.value) return "";
  return (
    errandReasonText({
      available: false,
      reason: props.errandUnavailableReason || "",
      reasonText: props.errandUnavailableReasonText || "",
    }) || MERCHANT_ERRAND_UNAVAILABLE_FALLBACK
  );
});

const errandAvailableForCta = computed(() =>
  showErrandEntry.value && !errandUnavailable.value ? true : undefined,
);

const cta = useErrandHelpCta({
  available: errandAvailableForCta,
  merchantPostId: toRef(props, "merchantPostId"),
  hasPermission: toRef(props, "viewerCanOrderErrand"),
  blockedReason: unavailableReasonLabel,
});

// Legacy contract: `errandEntryClickable` is what the existing
// merchant-block structure test pins. The composable owns the truth, but
// we keep the local computed so the source-text contract still matches.
const errandEntryClickable = computed(
  () => showErrandEntry.value && (props.merchantPostId ?? 0) > 0,
);

const errandCtaState = computed(() => cta.state.value);

const errandCtaMessage = computed(() => {
  if (cta.state.value === "loading") return MERCHANT_ERRAND_HINT;
  if (cta.state.value === "reason" && !errandUnavailable.value) {
    // Permission-blocked branch (the only "reason" path that is not the
    // legacy "merchant paused" copy). Surface the dedicated reason copy so
    // the user knows it's about their account, not the merchant.
    return MERCHANT_ERRAND_PERMISSION_BLOCKED_HINT;
  }
  return errandUnavailable.value ? unavailableReasonLabel.value : MERCHANT_ERRAND_HINT;
});

const errandWrapperTestId = computed(() =>
  errandUnavailable.value
    ? "post-detail-merchant-errand-unavailable"
    : "post-detail-merchant-errand-entry",
);
const errandMessageTestId = computed(() =>
  errandUnavailable.value
    ? "post-detail-merchant-errand-reason"
    : "post-detail-merchant-errand-hint",
);

const errandCtaTitle = computed(() =>
  cta.state.value === "reason" && !errandUnavailable.value
    ? MERCHANT_ERRAND_PERMISSION_BLOCKED_TITLE
    : "",
);

function handleErrandClick() {
  if (!cta.clickable.value) return;
  // The composable's runClick latches loading / success / failure — but the
  // navigation is synchronous here (we set the active view and unmount), so
  // we route through it as a void coroutine that completes immediately. The
  // success bit then sticks across detail re-mounts, which matches the
  // product spec ("保持 success" rather than auto-clearing).
  void cta.runClick(() => {
    detail.close("view-change");
    // PR2 (#609) — also seed the pickup hint with `merchant.name` so the order
    // form opens with "到 <商家> 取" already filled. The merchant DTO doesn't
    // ship a structured address, but the name is the runner-facing label
    // that actually matters; users append门店细节 in the same field if needed.
    errandRoute.enterForMerchant(props.merchantPostId as number, "feed", props.merchant.name || "");
    setActiveView("errand-order");
  });
}
</script>

<template>
  <section
    class="post-detail-merchant-block"
    :aria-label="MERCHANT_BLOCK_LABEL"
    data-testid="post-detail-merchant-block"
  >
    <header class="post-detail-merchant-block__header">
      <span class="post-detail-merchant-block__category" :data-category="merchant.category">
        {{ categoryLabel }}
      </span>
      <span class="post-detail-merchant-block__verified">
        {{ MERCHANT_VERIFIED_PREFIX }}
      </span>
      <span v-if="verifiedAtLabel" class="post-detail-merchant-block__verified-at">
        {{ verifiedAtLabel }}
      </span>
    </header>

    <h3 class="post-detail-merchant-block__name">{{ merchant.name }}</h3>

    <dl class="post-detail-merchant-block__meta">
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_CATEGORY_LABEL }}</dt>
        <dd>{{ categoryLabel }}</dd>
      </div>
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_HOURS_LABEL }}</dt>
        <dd>{{ hoursLabel }}</dd>
      </div>
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_CONTACT_LABEL }}</dt>
        <dd>{{ contactLabel }}</dd>
      </div>
    </dl>

    <div
      v-if="showErrandEntry || errandUnavailable"
      class="post-detail-merchant-block__errand"
      :class="{ 'is-unavailable': errandUnavailable }"
      :data-testid="errandWrapperTestId"
      :data-cta-clickable="errandEntryClickable ? 'true' : 'false'"
    >
      <p class="post-detail-merchant-block__errand-line">
        {{ errandUnavailable ? MERCHANT_ERRAND_UNAVAILABLE_LABEL : MERCHANT_ERRAND_AVAILABLE }}
      </p>
      <DetailCtaButton
        :label="MERCHANT_ERRAND_CTA"
        :state="errandCtaState"
        :message="errandCtaMessage"
        test-id="post-detail-merchant-errand-cta"
        :message-test-id="errandMessageTestId"
        :title-hint="errandCtaTitle"
        @click="handleErrandClick"
      />
    </div>
  </section>
</template>

<style scoped>
.post-detail-merchant-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-merchant-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-merchant-block__category {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(255, 167, 38, 0.16);
  color: #a05a00;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-merchant-block__category[data-category="service"] {
  background: rgba(31, 167, 160, 0.14);
  color: #1a6f6c;
}

.post-detail-merchant-block__category[data-category="retail"] {
  background: rgba(120, 100, 200, 0.16);
  color: #5a4aa0;
}

.post-detail-merchant-block__verified {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.18);
  color: #1a6f6c;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-merchant-block__verified-at {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-merchant-block__name {
  margin: 0;
  color: var(--lian-ink);
  font-size: 16px;
  line-height: 1.4;
}

.post-detail-merchant-block__meta {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.post-detail-merchant-block__row {
  display: grid;
  grid-template-columns: 5em 1fr;
  gap: var(--space-2);
}

.post-detail-merchant-block__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-merchant-block__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-merchant-block__errand {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed rgba(31, 167, 160, 0.35);
  border-radius: var(--radius-card, 12px);
  background: rgba(31, 167, 160, 0.06);
}

.post-detail-merchant-block__errand.is-unavailable {
  border-color: rgba(120, 120, 120, 0.32);
  background: rgba(120, 120, 120, 0.06);
}

.post-detail-merchant-block__errand-line {
  margin: 0;
  color: var(--lian-ink);
  font-weight: 700;
  font-size: 14px;
}
</style>
