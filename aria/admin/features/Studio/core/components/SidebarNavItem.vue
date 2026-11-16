<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import { Button } from "@/components/ui/button";
import { resolveButtonEl } from "@/features/Studio/core/utils/resolveButtonEl";

const props = defineProps<{
  label: string;
  path: string;
  icon: string;
  active: boolean;
  collapsed: boolean;
  indicatorId?: string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
  registerIndicator: [id: string, el: HTMLElement | null];
  indicatorEnter: [id: string];
}>();

const buttonRef = ref<ComponentPublicInstance | null>(null);

function syncIndicatorTarget() {
  if (!props.indicatorId) return;
  emit(
    "registerIndicator",
    props.indicatorId,
    resolveButtonEl(buttonRef.value),
  );
}

function handleClick() {
  emit("navigate", props.path);
}

function handleMouseEnter() {
  if (props.indicatorId) {
    emit("indicatorEnter", props.indicatorId);
  }
}

watch(buttonRef, syncIndicatorTarget, { flush: "post" });
watch(() => props.indicatorId, syncIndicatorTarget, { flush: "post" });

onMounted(syncIndicatorTarget);

onBeforeUnmount(() => {
  if (props.indicatorId) {
    emit("registerIndicator", props.indicatorId, null);
  }
});

function buttonClasses() {
  const tone = props.active
    ? "!text-sidebar-foreground font-semibold!"
    : "!text-muted-foreground/75 hover:!text-sidebar-foreground";
  if (props.collapsed) {
    return `sidebar-nav-target w-full !justify-start gap-3 px-4 py-2 font-regular! h-10! transition-[color,box-shadow,font-weight] duration-100 ${tone}`;
  }
  return `sidebar-nav-target w-full !justify-start gap-3 px-4 py-2 font-regular! h-10! transition-[color,box-shadow,font-weight] duration-100 ${tone}`;
}

const activeStyle = {
  backgroundColor:
    "color-mix(in oklch, var(--aria-brand-primary) 20%, transparent)",
};
</script>

<template>
  <div class="sidebar-item">
    <Button
      ref="buttonRef"
      :variant="active ? 'nav-active' : 'nav'"
      :class="buttonClasses()"
      :style="active ? activeStyle : undefined"
      :aria-label="label"
      @click="handleClick"
      @mouseenter="handleMouseEnter"
    >
      <span
        :class="[icon, 'size-5 shrink-0']"
        :style="active ? { color: 'var(--aria-brand-primary)' } : undefined"
      />
      <span v-if="!collapsed">{{ label }}</span>
    </Button>
  </div>
</template>
