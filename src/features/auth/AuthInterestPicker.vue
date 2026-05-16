<script setup lang="ts">
import {
  AUTH_INTEREST_SECTION,
  AUTH_INTEREST_RELOAD,
  AUTH_INTEREST_SKIP,
} from "../../config/brand";
import { AUTH_MAX_INTEREST_SELECTIONS } from "../../domain/validation/forms";
import type { AuthInterestOption } from "../../api/auth";
import type { AuthInterestStatus } from "./useAuthForm";

defineProps<{
  options: AuthInterestOption[];
  selected: string[];
  status: AuthInterestStatus;
  hasChoices: boolean;
  showSkip: boolean;
  hint: string;
  isDisabled: (id: string) => boolean;
}>();

defineEmits<{
  toggle: [id: string];
  skip: [];
  refresh: [];
}>();
</script>

<template>
  <section class="auth-interest-picker" :aria-label="AUTH_INTEREST_SECTION">
    <div class="auth-interest-picker__header">
      <div class="auth-interest-picker__copy">
        <strong>{{ AUTH_INTEREST_SECTION }}</strong>
        <small class="auth-panel__hint">{{ hint }}</small>
      </div>
      <span v-if="hasChoices">{{ selected.length }}/{{ AUTH_MAX_INTEREST_SELECTIONS }}</span>
    </div>

    <div v-if="hasChoices" class="auth-interest-picker__grid">
      <button
        v-for="interest in options"
        :key="interest.id"
        type="button"
        class="auth-interest-picker__item"
        :class="{ 'is-active': selected.includes(interest.id) }"
        :aria-pressed="selected.includes(interest.id)"
        :disabled="isDisabled(interest.id)"
        @click="$emit('toggle', interest.id)"
      >
        <strong>{{ interest.label }}</strong>
        <span>{{ interest.description }}</span>
      </button>
    </div>

    <div v-else-if="status === 'unavailable'" class="auth-interest-picker__state">
      <button type="button" class="auth-interest-picker__secondary-action" @click="$emit('refresh')">
        {{ AUTH_INTEREST_RELOAD }}
      </button>
    </div>

    <div v-if="showSkip" class="auth-interest-picker__actions">
      <button type="button" class="auth-interest-picker__secondary-action" @click="$emit('skip')">
        {{ AUTH_INTEREST_SKIP }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.auth-interest-picker {
  display: grid;
  gap: var(--space-4);
}

.auth-interest-picker__header,
.auth-interest-picker__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.auth-interest-picker__copy {
  display: grid;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 800;
}

.auth-interest-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: var(--space-2);
}

.auth-interest-picker__item {
  display: grid;
  gap: 4px;
  min-height: 76px;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
  text-align: left;
}

.auth-interest-picker__item strong {
  color: var(--lian-ink);
}

.auth-interest-picker__item span {
  font-size: 12px;
  line-height: 1.45;
}

.auth-interest-picker__item.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.14);
  color: var(--lian-ink);
}

.auth-interest-picker__item:disabled {
  opacity: 0.62;
}

.auth-interest-picker__state {
  display: flex;
  justify-content: flex-start;
}

.auth-interest-picker__secondary-action {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font-weight: 900;
}
</style>
