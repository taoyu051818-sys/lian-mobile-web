<script setup lang="ts">
/**
 * Publish-page gate notice (PR-2).
 *
 * Unifies the three "you need to verify before you can publish this kind"
 * panels that previously each owned their own structure / styling:
 *
 *   - PublishView affordance-gate (merchant lock at the top of the form)
 *   - PublishMerchantControls inner gate (when v-if !merchantVerified)
 *   - PublishTradeControls inner gate (when v-if !campusVerified)
 *
 * All three are the same shape: title + hint + (optional) block paragraph
 * + CTA button. By centralising the structure here, we get one set of
 * spacing / colour / a11y rules instead of three slightly different ones.
 *
 * Slot usage (default slot is the body copy block; consumers can pass any
 * mix of <p> elements). Title and CTA are bound props because they are
 * the load-bearing semantics for accessibility.
 */

defineProps<{
  title: string;
  ctaLabel: string;
}>();

defineEmits<{
  cta: [];
}>();
</script>

<template>
  <section class="publish-gate-notice" :aria-label="title">
    <div class="publish-gate-notice__copy">
      <strong class="publish-gate-notice__title">{{ title }}</strong>
      <slot />
    </div>
    <button type="button" class="publish-gate-notice__cta" @click="$emit('cta')">
      {{ ctaLabel }}
    </button>
  </section>
</template>

<style scoped>
.publish-gate-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed rgba(31, 167, 160, 0.32);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(31, 167, 160, 0.08);
}

.publish-gate-notice__copy {
  display: grid;
  gap: 4px;
  flex: 1 1 240px;
}

.publish-gate-notice__title {
  font-size: 15px;
}

.publish-gate-notice__copy :deep(p) {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
}

.publish-gate-notice__copy :deep(.publish-gate-notice__block) {
  color: #a14040;
  font-weight: 700;
}

.publish-gate-notice__cta {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary, #1fa7a0);
  color: white;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-4);
  cursor: pointer;
}
</style>
