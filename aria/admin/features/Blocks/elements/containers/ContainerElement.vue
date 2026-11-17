<script setup lang="ts">
import BaseElement from "../BaseElement.vue";

const props = defineProps<{
  viewMode?: "grid" | "list";
}>();

const elementMeta = {
  name: "Container",
  type: "container",
  icon: "i-lucide:box-select",
  category: "containers",
};

const elementData = {
  type: "container",
  props: {
    element: "div",
  },
  classNames: { base: [] },
  customClasses: [],
  styles: {},
  children: [],
};

defineExpose({
  elementMeta,
  elementData,
});
</script>

<template>
  <BaseElement
    icon="i-lucide:box-select"
    :label="elementMeta.name"
    :view-mode="props.viewMode"
  />
</template>
