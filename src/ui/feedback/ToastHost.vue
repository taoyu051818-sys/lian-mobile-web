<script setup lang="ts">
import Toast from "../Toast.vue";
import { useToast } from "./useToast";

const toast = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-relevant="additions removals">
      <Toast
        v-for="item in toast.items"
        :key="item.id"
        class="toast-host__item"
        :tone="item.tone"
      >
        <span>{{ item.message }}</span>
        <button type="button" aria-label="关闭提示" @click="toast.remove(item.id)">×</button>
      </Toast>
    </div>
  </Teleport>
</template>
