<script setup lang="ts">
import CmsCollectionIconPreview from "@/features/CMS/components/CmsCollectionIconPreview.vue";

withDefaults(
  defineProps<{
    label: string;
    icon?: string;
    viewMode?: "grid" | "list";
  }>(),
  { icon: "i-lucide:component", viewMode: "grid" },
);
</script>

<template>
  <div
    v-if="viewMode === 'list'"
    class="group flex items-center gap-2 rounded-md border border-border bg-card/30 px-2 py-1.5 transition-all duration-100 hover:bg-card/70"
  >
    <CmsCollectionIconPreview
      :value="icon"
      class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
    />
    <span
      class="min-w-0 truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground"
    >
      {{ label }}
    </span>
  </div>

  <div
    v-else
    class="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card/50 p-3 transition-all hover:border-primary/50 hover:bg-primary/5"
  >
    <CmsCollectionIconPreview
      :value="icon"
      class="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
    />
    <span
      class="max-w-full truncate text-center text-xs text-muted-foreground transition-colors group-hover:text-foreground"
      :title="label"
    >
      {{ label }}
    </span>
  </div>
</template>
