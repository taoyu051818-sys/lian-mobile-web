<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  PROFILE_STATS_SECTION_LABEL,
  PROFILE_STATS_POSTS,
  PROFILE_STATS_REPLIES,
  PROFILE_STATS_SAVED,
  PROFILE_STATS_LIKED,
  PROFILE_STATS_MAP_CONTRIBUTIONS,
  PROFILE_STATS_DRAFTS,
  PROFILE_STATS_LOAD_ERROR,
  PROFILE_STATS_RELOAD,
} from "../../config/brand";
import { fetchProfileStats } from "../../api/profile";
import type { ProfileStats } from "../../types/profile";
import ProfileRewardsBlock from "./ProfileRewardsBlock.vue";

const stats = ref<ProfileStats | null>(null);
const loading = ref(false);
const errorMessage = ref("");

async function loadStats() {
  loading.value = true;
  errorMessage.value = "";
  try {
    stats.value = await fetchProfileStats();
  } catch {
    stats.value = null;
    errorMessage.value = PROFILE_STATS_LOAD_ERROR;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadStats();
});

defineExpose({ reload: loadStats });
</script>

<template>
  <section
    class="profile-stats-block"
    :aria-label="PROFILE_STATS_SECTION_LABEL"
    data-testid="profile-stats-block"
  >
    <header class="profile-stats-block__head">
      <h2>{{ PROFILE_STATS_SECTION_LABEL }}</h2>
    </header>

    <p
      v-if="errorMessage"
      class="profile-stats-block__error"
      role="alert"
      data-testid="profile-stats-error"
    >
      {{ errorMessage }}
      <button type="button" @click="loadStats">{{ PROFILE_STATS_RELOAD }}</button>
    </p>

    <dl
      v-else-if="stats"
      class="profile-stats-block__grid"
      data-testid="profile-stats-grid"
      :aria-busy="loading"
    >
      <div data-testid="profile-stats-cell" data-stat="posts">
        <dt>{{ PROFILE_STATS_POSTS }}</dt>
        <dd>{{ stats.posts }}</dd>
      </div>
      <div data-testid="profile-stats-cell" data-stat="replies">
        <dt>{{ PROFILE_STATS_REPLIES }}</dt>
        <dd>{{ stats.replies }}</dd>
      </div>
      <div data-testid="profile-stats-cell" data-stat="saved">
        <dt>{{ PROFILE_STATS_SAVED }}</dt>
        <dd>{{ stats.saved }}</dd>
      </div>
      <div data-testid="profile-stats-cell" data-stat="liked">
        <dt>{{ PROFILE_STATS_LIKED }}</dt>
        <dd>{{ stats.liked }}</dd>
      </div>
      <div data-testid="profile-stats-cell" data-stat="mapContributions">
        <dt>{{ PROFILE_STATS_MAP_CONTRIBUTIONS }}</dt>
        <dd>{{ stats.mapContributions }}</dd>
      </div>
      <div data-testid="profile-stats-cell" data-stat="drafts">
        <dt>{{ PROFILE_STATS_DRAFTS }}</dt>
        <dd>{{ stats.drafts }}</dd>
      </div>
    </dl>

    <ProfileRewardsBlock />
  </section>
</template>

<style scoped>
.profile-stats-block {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 167, 160, 0.14);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.profile-stats-block__head h2 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.profile-stats-block__error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(255, 159, 67, 0.32);
  border-radius: var(--radius-3);
  background: rgba(255, 159, 67, 0.1);
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 700;
}

.profile-stats-block__error button {
  min-height: 28px;
  margin-left: var(--space-2);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.74);
  color: currentColor;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.profile-stats-block__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
}

.profile-stats-block__grid > div {
  display: grid;
  gap: 2px;
  padding: var(--space-2);
  border: 1px solid rgba(31, 41, 51, 0.06);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.profile-stats-block__grid dt {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.02em;
}

.profile-stats-block__grid dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 900;
}
</style>
