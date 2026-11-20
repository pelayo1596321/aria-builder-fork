<script setup lang="ts">
import SiteSettingsView from "../settings/components/SiteSettingsView.vue";
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-auto">
    <header class="border-b border-dashed border-border px-7 py-5">
      <h1 class="text-xl font-semibold">General Settings</h1>
      <p class="text-sm text-muted-foreground">Configure your site settings</p>
    </header>
    <div class="w-full max-w-4xl px-7 py-7">
      <SiteSettingsView />
    </div>
  </section>
</template>
