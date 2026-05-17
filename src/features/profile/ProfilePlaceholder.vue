<script setup lang="ts">
import { DEFAULT_PROFILE_SETTINGS, DEFAULT_PROFILE_STATS } from "../../api/profile";
import ProfileSummary from "./ProfileSummary.vue";
</script>

<template>
  <ProfileSummary
    :stats="DEFAULT_PROFILE_STATS"
    :settings="DEFAULT_PROFILE_SETTINGS"
    :loading="false"
    error=""
    :has-forum-link="false"
  />
</template>
