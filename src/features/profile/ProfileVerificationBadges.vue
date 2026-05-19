<script setup lang="ts">
import { computed } from "vue";
import { PROFILE_VERIFICATION_BADGES_LABEL } from "../../config/brand";
import {
  VERIFICATION_DESCRIPTORS,
  type VerificationDescriptor,
} from "../verification/verification-format";
import type { ProfileUser } from "../../types/profile";
import type { VerificationRecord } from "../../types/verification";

const props = defineProps<{
  user: ProfileUser;
}>();

interface ActiveBadge {
  tag: VerificationDescriptor["tag"];
  label: string;
}

// Header surfaces only currently-active grants. Expired/revoked records
// stay visible in the verification center where the user can act on them.
const activeBadges = computed<ActiveBadge[]>(() => {
  const state = props.user.verificationState;
  const fallbackTags = new Set<string>([
    ...(props.user.verificationTags || []),
    ...(props.user.tags || []),
  ]);
  return VERIFICATION_DESCRIPTORS.filter((d) => {
    const record: VerificationRecord | undefined = state?.[d.tag];
    if (record) return Boolean(record.active);
    return fallbackTags.has(d.tag);
  }).map((d) => ({ tag: d.tag, label: d.label }));
});
</script>

<template>
  <div
    v-if="activeBadges.length"
    class="profile-verification-badges"
    :aria-label="PROFILE_VERIFICATION_BADGES_LABEL"
    data-testid="profile-verification-badges"
  >
    <span
      v-for="badge in activeBadges"
      :key="badge.tag"
      class="profile-verification-badges__badge"
      :data-tag="badge.tag"
      data-testid="profile-verification-badge"
    >
      {{ badge.label }}
    </span>
  </div>
</template>

<style scoped>
.profile-verification-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
}

.profile-verification-badges__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.14);
  border: 1px solid rgba(31, 167, 160, 0.28);
  color: var(--lian-primary-deep, #0f6b66);
  font-size: 12px;
  font-weight: 850;
  line-height: 1.4;
  white-space: nowrap;
}

.profile-verification-badges__badge[data-tag="merchant_verified"] {
  background: rgba(255, 159, 67, 0.14);
  border-color: rgba(255, 159, 67, 0.34);
  color: #b76a17;
}

.profile-verification-badges__badge[data-tag="realname_verified"] {
  background: rgba(91, 184, 214, 0.16);
  border-color: rgba(91, 184, 214, 0.32);
  color: #1f6f8b;
}

.profile-verification-badges__badge[data-tag="runner"] {
  background: rgba(124, 92, 255, 0.14);
  border-color: rgba(124, 92, 255, 0.32);
  color: #5a3fbf;
}
</style>
