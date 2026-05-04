<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  open?: boolean;
}>(), {
  title: "",
  open: true
});

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div v-if="open" class="lian-sheet" role="dialog" aria-modal="true" :aria-label="title || '弹层'">
    <div class="lian-sheet__backdrop" @click="emit('close')"></div>
    <section class="lian-sheet__panel">
      <header v-if="title || $slots.actions" class="lian-sheet__header">
        <h2 v-if="title">{{ title }}</h2>
        <slot name="actions">
          <button class="lian-sheet__close" type="button" aria-label="关闭" @click="emit('close')">×</button>
        </slot>
      </header>
      <slot />
    </section>
  </div>
</template>
