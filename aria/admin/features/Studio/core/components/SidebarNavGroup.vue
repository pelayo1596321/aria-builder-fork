<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import type { ComponentPublicInstance } from "vue";
import { Button } from "@/components/ui/button";
import { resolveButtonEl } from "@/features/Studio/core/utils/resolveButtonEl";
import { studioIcons } from "@/lib/icons";

const props = withDefaults(
  defineProps<{
    label: string;
    icon: string;
    groupId: string;
    open: boolean;
    active: boolean;
    collapsed: boolean;
    indicatorId?: string;
    renderChildren?: boolean;
    inlineChildren?: boolean;
  }>(),
  {
    renderChildren: true,
    inlineChildren: false,
  },
);

const emit = defineEmits<{
  expand: [groupId: string];
  toggle: [groupId: string];
  hover: [groupId: string];
  collapsedHover: [event: MouseEvent];
  collapsedLeave: [];
  registerIndicator: [id: string, el: HTMLElement | null];
  indicatorEnter: [id: string];
}>();

function handleCollapsedTriggerEnter(event: MouseEvent) {
  emit("hover", props.groupId);
  handleIndicatorEnter();
  emit("collapsedHover", event);
}

function handleExpandedTriggerEnter() {
  emit("hover", props.groupId);
  handleIndicatorEnter();
}

function handleClick() {
  // Expand the sidebar so users can choose a child in place.
  if (props.collapsed) {
    emit("expand", props.groupId);
    return;
  }
  emit("toggle", props.groupId);
}

const buttonRef = ref<ComponentPublicInstance | null>(null);

function syncIndicatorTarget() {
  if (!props.indicatorId) return;
  emit(
    "registerIndicator",
    props.indicatorId,
    resolveButtonEl(buttonRef.value),
  );
}

function handleIndicatorEnter() {
  if (props.indicatorId) {
    emit("indicatorEnter", props.indicatorId);
  }
}

function buttonClasses() {
  const tone = props.active
    ? "!text-sidebar-foreground font-semibold!"
    : "!text-muted-foreground/75 hover:!text-sidebar-foreground";
  if (props.collapsed) {
    return `sidebar-nav-target w-full !justify-start gap-3 px-4 py-2 h-10! font-medium! transition-[color,box-shadow,font-weight] duration-100 ${tone}`;
  }
  return `sidebar-nav-target w-full !justify-start gap-3 px-4 py-2 h-10! font-medium! transition-[color,box-shadow,font-weight] duration-100 ${tone}`;
}

const activeStyle = {
  backgroundColor:
    "color-mix(in oklch, var(--aria-brand-primary) 20%, transparent)",
};

onMounted(() => {
  syncIndicatorTarget();
});

onBeforeUnmount(() => {
  if (props.indicatorId) {
    emit("registerIndicator", props.indicatorId, null);
  }
});

watch(buttonRef, syncIndicatorTarget, { flush: "post" });
watch(() => [props.indicatorId, props.collapsed] as const, syncIndicatorTarget, {
  flush: "post",
});

</script>

<template>
  <div class="sidebar-item">
    <div
      v-if="collapsed"
      @mouseenter="handleCollapsedTriggerEnter"
      @mouseleave="emit('collapsedLeave')"
    >
      <Button
        ref="buttonRef"
        :variant="active ? 'nav-active' : 'nav'"
        :class="buttonClasses()"
        :style="active ? activeStyle : undefined"
        :aria-label="label"
        @click="handleClick"
      >
        <span
          :class="[icon, 'size-5 shrink-0']"
          :style="active ? { color: 'var(--aria-brand-primary)' } : undefined"
        />
      </Button>
    </div>

    <div v-else>
      <Button
        ref="buttonRef"
        :variant="active ? 'nav-active' : 'nav'"
        :class="buttonClasses()"
        :style="active ? activeStyle : undefined"
        :aria-label="label"
        @mouseenter="handleExpandedTriggerEnter"
        @focusin="handleExpandedTriggerEnter"
        @click="handleClick"
      >
        <span
          :class="[icon, 'size-5 shrink-0']"
          :style="active ? { color: 'var(--aria-brand-primary)' } : undefined"
        />
        <span class="flex-1 text-left">{{ label }}</span>
        <span
          :class="[
            studioIcons.chevronRight,
            'ml-auto size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          ]"
          aria-hidden="true"
        />
      </Button>
    </div>
    <div
      v-if="inlineChildren && renderChildren && !collapsed && open"
      class="ml-5.3 flex flex-col gap-0 border-l border-border border-dashed py-1 pl-0"
    >
      <slot name="children" />
    </div>
  </div>
  <Teleport
    v-if="renderChildren && !inlineChildren && open"
    to="#studio-sidebar-submenu-items"
    defer
  >
    <slot name="children" />
  </Teleport>
</template>
