<script setup lang="ts">
defineProps<{
  icon: string;
}>();
</script>

<template>
  <svg
    v-if="icon === 'i-lucide:code'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </svg>
  <svg
    v-else-if="icon === 'i-lucide:box-select'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="M5 3a2 2 0 0 0-2 2m16-2a2 2 0 0 1 2 2m0 14a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1m4-18h1m-1 18h1M3 9v1m18-1v1M3 14v1m18-1v1"
    />
  </svg>
  <span v-else :class="icon" aria-hidden="true" />
</template>
