<script setup lang="ts">
import BaseElement from "../BaseElement.vue";

const props = defineProps<{
  viewMode?: "grid" | "list";
}>();

const elementMeta = {
  name: "Section",
  type: "section",
  icon: "i-lucide:code",
  category: "containers",
};

const elementData = {
  type: "section",
  props: {
    element: "section",
  },
  classNames: { base: [] },
  customClasses: [],
  children: [
    {
      type: "Container",
      props: {
        element: "div",
      },
      classNames: { base: [] },
      customClasses: [],
      children: [],
      styles: {},
    },
  ],
  styles: {},
};

defineExpose({
  elementMeta,
  elementData,
});
</script>

<template>
  <BaseElement
    icon="i-lucide:code"
    :label="elementMeta.name"
    :view-mode="props.viewMode"
  />
</template>
