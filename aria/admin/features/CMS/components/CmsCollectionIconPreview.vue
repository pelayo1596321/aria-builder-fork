<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { resolveOneIconSvgData } from "@/lib/iconDataClient";
import { getCanonicalIconIdFromValue } from "../../../../lib/icons/reference";

const props = withDefaults(
  defineProps<{
    value?: string | null;
  }>(),
  {
    value: null,
  },
);

const hydratedSvg = ref("");
let activeHydrationRun = 0;

const iconValue = computed(() => props.value?.trim() ?? "");
const canonicalId = computed(() => getCanonicalIconIdFromValue(iconValue.value));
const isUrl = computed(() =>
  /^(https?:\/\/|\/|blob:|data:image\/svg\+xml)/.test(iconValue.value),
);

watch(
  canonicalId,
  async (id) => {
    const hydrationRun = ++activeHydrationRun;
    hydratedSvg.value = "";
    if (!id) return;

    try {
      const svg = (await resolveOneIconSvgData(id))?.svg ?? "";
      if (hydrationRun === activeHydrationRun) hydratedSvg.value = svg;
    } catch {
      if (hydrationRun === activeHydrationRun) hydratedSvg.value = "";
    }
  },
  { immediate: true },
);
</script>

<template>
  <img
    v-if="isUrl"
    :src="iconValue"
    alt=""
    class="block object-contain"
    loading="lazy"
  />
  <span
    v-else-if="hydratedSvg"
    class="relative block"
  >
    <span
      class="absolute inset-0 [&>svg]:block [&>svg]:size-full"
      v-html="hydratedSvg"
    />
  </span>
  <span v-else :class="iconValue" />
</template>
