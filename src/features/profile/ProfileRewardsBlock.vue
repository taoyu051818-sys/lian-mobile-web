<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  PROFILE_REWARDS_EMPTY,
  PROFILE_REWARDS_HONORS_LABEL,
  PROFILE_REWARDS_LOAD_ERROR,
  PROFILE_REWARDS_LOCKED_POINTS_LABEL,
  PROFILE_REWARDS_PLACEHOLDER,
  PROFILE_REWARDS_POINTS_LABEL,
  PROFILE_REWARDS_SECTION_LABEL,
} from "../../config/brand";
import { fetchProfileRewards, fetchProfileWallet } from "../../api/profile";
import type { ProfileRewards, ProfileWallet } from "../../types/profile";

const wallet = ref<ProfileWallet | null>(null);
const rewards = ref<ProfileRewards | null>(null);
const errorMessage = ref("");

const walletSummary = computed(() => rewards.value?.balances || wallet.value);
const rewardEntries = computed(() => rewards.value?.entries?.slice(0, 3) || []);
const rewardsActive = computed(() => rewards.value?.lifecycle === "active");

async function loadRewards() {
  errorMessage.value = "";
  const [walletResult, rewardsResult] = await Promise.allSettled([
    fetchProfileWallet(),
    fetchProfileRewards(),
  ]);

  wallet.value = walletResult.status === "fulfilled" ? walletResult.value : null;
  rewards.value = rewardsResult.status === "fulfilled" ? rewardsResult.value : null;
  if (walletResult.status === "rejected" && rewardsResult.status === "rejected") {
    errorMessage.value = PROFILE_REWARDS_LOAD_ERROR;
  }
}

onMounted(() => {
  void loadRewards();
});

defineExpose({ reload: loadRewards });
</script>

<template>
  <section
    class="profile-rewards-block"
    :aria-label="PROFILE_REWARDS_SECTION_LABEL"
    data-testid="profile-rewards-surface"
  >
    <h3>{{ PROFILE_REWARDS_SECTION_LABEL }}</h3>
    <p v-if="errorMessage" class="profile-rewards-block__hint" role="alert">
      {{ errorMessage }}
    </p>
    <dl
      v-else-if="walletSummary"
      class="profile-rewards-block__wallet-grid"
      data-testid="profile-wallet-summary"
    >
      <div data-wallet-stat="points">
        <dt>{{ PROFILE_REWARDS_POINTS_LABEL }}</dt>
        <dd>{{ walletSummary.points }}</dd>
      </div>
      <div data-wallet-stat="honor">
        <dt>{{ PROFILE_REWARDS_HONORS_LABEL }}</dt>
        <dd>{{ walletSummary.honor }}</dd>
      </div>
      <div data-wallet-stat="lockedPoints">
        <dt>{{ PROFILE_REWARDS_LOCKED_POINTS_LABEL }}</dt>
        <dd>{{ walletSummary.lockedPoints }}</dd>
      </div>
    </dl>
    <ul
      v-if="rewardsActive && rewardEntries.length"
      class="profile-rewards-block__ledger"
      data-testid="profile-rewards-ledger"
    >
      <li v-for="entry in rewardEntries" :key="entry.id">
        <span>
          {{
            entry.currency === "points"
              ? PROFILE_REWARDS_POINTS_LABEL
              : PROFILE_REWARDS_HONORS_LABEL
          }}
        </span>
        <strong>+{{ entry.delta }}</strong>
      </li>
    </ul>
    <p
      v-else-if="rewardsActive"
      class="profile-rewards-block__hint"
      data-testid="profile-rewards-empty"
    >
      {{ PROFILE_REWARDS_EMPTY }}
    </p>
    <p v-else class="profile-rewards-block__hint" data-testid="profile-rewards-placeholder">
      {{ PROFILE_REWARDS_PLACEHOLDER }}
    </p>
  </section>
</template>

<style scoped>
.profile-rewards-block {
  display: grid;
  gap: 4px;
  padding: var(--space-3);
  border-top: 1px dashed rgba(31, 167, 160, 0.18);
}

.profile-rewards-block h3 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 900;
}

.profile-rewards-block__wallet-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
}

.profile-rewards-block__wallet-grid > div {
  display: grid;
  gap: 2px;
  padding: var(--space-2);
  border-radius: var(--radius-3);
  background: rgba(31, 167, 160, 0.08);
  text-align: center;
}

.profile-rewards-block__wallet-grid dt {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 850;
}

.profile-rewards-block__wallet-grid dd {
  margin: 0;
  color: var(--lian-primary-deep, #0f6b66);
  font-size: 17px;
  font-weight: 950;
}

.profile-rewards-block__ledger {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-rewards-block__ledger li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.profile-rewards-block__ledger strong {
  color: var(--lian-primary-deep, #0f6b66);
}

.profile-rewards-block__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}
</style>
