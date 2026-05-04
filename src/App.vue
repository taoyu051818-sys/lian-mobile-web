<script setup lang="ts">
const migrationSteps = [
  "Design tokens and UI guidelines are now first-class frontend assets.",
  "Legacy static scripts keep serving the current mobile experience.",
  "New LIAN UI components can be built in Vue before page-level migration.",
  "Feed, publish, map, messages, profile and detail views will migrate one boundary at a time."
];
</script>

<template>
  <main class="vue-shell" aria-labelledby="vue-shell-title">
    <section class="vue-shell__panel">
      <p class="vue-shell__eyebrow">LIAN UI Architecture</p>
      <h1 id="vue-shell-title">Vue 3 + Vite + TypeScript entry is ready</h1>
      <p class="vue-shell__summary">
        This is the new non-invasive Vue shell. The existing legacy mobile frontend remains available while UI components migrate gradually.
      </p>
      <ol class="vue-shell__steps">
        <li v-for="step in migrationSteps" :key="step">{{ step }}</li>
      </ol>
    </section>
  </main>
</template>
