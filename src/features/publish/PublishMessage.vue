<script setup lang="ts">
/**
 * Publish-page message primitive (PR-2).
 *
 * Unifies all default-pop banners on the publish page that previously
 * each owned their own border / background / typography:
 *
 *   - inline error (errorMessage)              -> variant="error"
 *   - draft-restored notice                    -> variant="info"
 *   - successful publish + view-post link      -> variant="success"
 *   - AI pending status                        -> variant="pending"
 *   - AI risk flags                            -> variant="warning"
 *   - trade form risk hint                     -> variant="warning"
 *
 * Behaviour rules:
 *   - error / warning / info / success / pending all default-pop. They are
 *     "show me now" risk / status messages, not collapsible operation hints.
 *   - The "default-collapsed operation hint" primitive is intentionally NOT
 *     introduced here: PR-1 (#811) already removed the only default-pop
 *     operation hint on the page (PublishMerchantControls subpanel) and
 *     downgraded it to an inline checkbox. There is no remaining surface
 *     for it.
 *
 * The component owns container styling only; consumers compose any
 * inner content (paragraph, list, link, etc.) via the default slot.
 * Use `class="publish-message__list"` on a nested <ul> for warning-style
 * bullet lists (e.g. AI risk flags). aria roles are derived from variant
 * so consumers don't have to remember which variant is alert vs status.
 */

type PublishMessageVariant = "error" | "warning" | "info" | "success" | "pending";

const props = defineProps<{
  variant: PublishMessageVariant;
}>();

function ariaRoleFor(variant: PublishMessageVariant): string | undefined {
  if (variant === "error") return "alert";
  if (variant === "pending" || variant === "success") return "status";
  return undefined;
}

function ariaLiveFor(variant: PublishMessageVariant): "polite" | undefined {
  if (variant === "pending" || variant === "success") return "polite";
  return undefined;
}
</script>

<template>
  <div
    class="publish-message"
    :class="`publish-message--${props.variant}`"
    :role="ariaRoleFor(props.variant)"
    :aria-live="ariaLiveFor(props.variant)"
  >
    <slot />
  </div>
</template>

<style scoped>
.publish-message {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.publish-message--error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--lian-danger);
  border: 1px solid rgba(239, 68, 68, 0.18);
}

.publish-message--warning {
  background: rgba(255, 159, 67, 0.08);
  color: var(--lian-ink);
  border: 1px solid rgba(255, 159, 67, 0.28);
}

.publish-message--info {
  background: rgba(31, 167, 160, 0.1);
  color: var(--lian-ink);
  border: 1px solid rgba(31, 167, 160, 0.18);
  font-size: 14px;
}

.publish-message--success {
  display: grid;
  gap: var(--space-2);
  background: rgba(31, 167, 160, 0.08);
  color: var(--lian-primary);
  border: 1px solid rgba(31, 167, 160, 0.2);
  font-weight: 850;
}

.publish-message--pending {
  background: rgba(31, 167, 160, 0.06);
  color: var(--lian-muted);
  border: 1px dashed rgba(31, 167, 160, 0.3);
}

.publish-message :deep(.publish-message__list) {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}

.publish-message--warning :deep(.publish-message__list) li::before {
  content: "⚠ ";
}

.publish-message :deep(p) {
  margin: 0;
}
</style>
