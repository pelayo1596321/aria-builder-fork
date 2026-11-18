<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { studioIcons } from "@/lib/icons";
import { useAgentPanel } from "@/features/Agent/client/composables/useAgentPanel";

const props = defineProps<{
  itemType: "page" | "component";
  itemSlug?: string;
}>();

const emit = defineEmits<{
  addFirstElement: [];
}>();

const agentPanel = useAgentPanel();

const label = computed(() =>
  props.itemType === "page" ? "page" : "component",
);
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-30 overflow-hidden">
    <div
      class="pointer-events-auto absolute inset-0 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-5 text-center">
        <p class="max-w-sm text-base leading-relaxed text-muted-foreground">
          This {{ label }} is empty.
          <br />
          Add an element or chat with the Engineer.
        </p>

        <div class="flex items-center gap-4">
          <Button
            class="size-12 border-border/50! hover:text-primary!"
            variant="outline"
            size="icon-lg"
            @click="emit('addFirstElement')"
          >
            <span :class="[studioIcons.add, 'size-6']" aria-hidden="true" />
          </Button>
          <Button
            class="size-12 border-border/50! hover:text-primary!"
            variant="outline"
            size="icon-lg"
            @click="agentPanel.open()"
          >
            <span
              :class="[studioIcons.sparkles, 'size-6']"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
