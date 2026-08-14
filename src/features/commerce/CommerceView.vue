<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { parseCommerceRoute, type CommerceRoute } from "../../app/commerce-route";
import {
  COMMERCE_AVATAR_TEXT,
  COMMERCE_BACK_TO_PROFILE,
  COMMERCE_CLOSED_HINT,
  COMMERCE_CLOSED_TITLE,
  COMMERCE_SECTION_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import { EmptyState } from "../../ui";
import CommerceStoreListPage from "./catalog/CommerceStoreListPage.vue";
import CommerceProductDetailPage from "./product/CommerceProductDetailPage.vue";
import CommerceStoreDetailPage from "./store/CommerceStoreDetailPage.vue";
import { useCommerceStoreRead } from "./useCommerceStoreRead";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const route = shallowRef<CommerceRoute | null>(null);
const reader = useCommerceStoreRead();
let observedHash: string | null = null;

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    visible: true,
    identity: { avatarText: COMMERCE_AVATAR_TEXT, name: COMMERCE_SECTION_LABEL },
    buttons: [{ id: "commerce:close", label: COMMERCE_BACK_TO_PROFILE, variant: "ghost" }],
    onButtonClick: (id) => {
      if (id === "commerce:close") emit("close");
    },
  },
}));

function syncRouteFromLocation() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  // Browsers may dispatch both popstate and hashchange for one traversal.
  // Deduplicate the same raw URL so it cannot create a second request.
  if (hash === observedHash) return;
  observedHash = hash;
  route.value = parseCommerceRoute(hash);
  void reader.loadRoute(route.value);
}

onMounted(() => {
  emit("chrome", pageChrome.value);
  if (typeof window === "undefined") return;
  window.addEventListener("hashchange", syncRouteFromLocation);
  window.addEventListener("popstate", syncRouteFromLocation);
  syncRouteFromLocation();
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("hashchange", syncRouteFromLocation);
    window.removeEventListener("popstate", syncRouteFromLocation);
  }
  reader.dispose();
});
</script>

<template>
  <section class="commerce-view" :aria-label="COMMERCE_SECTION_LABEL">
    <CommerceProductDetailPage v-if="route?.name === 'product'" :product-id="route.productId" />

    <EmptyState
      v-else-if="reader.status.value === 'closed'"
      class="commerce-view__closed"
      :title="COMMERCE_CLOSED_TITLE"
      :description="COMMERCE_CLOSED_HINT"
      data-testid="commerce-closed"
    />

    <CommerceStoreListPage
      v-else-if="route?.name === 'catalog'"
      :status="reader.status.value"
      :error-kind="reader.errorKind.value"
      :items="reader.items.value"
      @retry="reader.retry"
    />

    <CommerceStoreDetailPage
      v-else
      :status="reader.status.value"
      :error-kind="reader.errorKind.value"
      :store="reader.store.value"
      @retry="reader.retry"
    />
  </section>
</template>

<style scoped>
.commerce-view {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.commerce-view__closed {
  min-height: 180px;
}
</style>
