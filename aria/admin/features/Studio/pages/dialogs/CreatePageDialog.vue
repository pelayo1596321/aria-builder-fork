<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioActions } from "@/features/Studio/composer/composables/useStudioActions";
import { useStudioCapabilities } from "@/composables/useStudioCapabilities";
import { slugify } from "@/lib/utils/slugify";
import { toast } from "vue-sonner";
import type { Layout, Page } from "@/composables/useBuilderData";
import { useStudioI18n } from "@/i18n";
import { studioIcons } from "@/lib/icons";
import {
  getLayoutDisplayLabelKey,
  sortLayoutsForPageSelector,
} from "../utils/layoutDisplayLabel";

type PageStartingPoint = "blank" | "template" | "ai";

interface Props {
  open: boolean;
  pages: readonly Page[];
  layouts: readonly Layout[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [slug: string, startingPoint: PageStartingPoint, title: string];
}>();

const { createPage } = useStudioActions();
const { t } = useStudioI18n();
const layoutDisplayName = (id: string, fallback: string) => {
  const labelKey = getLayoutDisplayLabelKey(id);
  return labelKey ? t(labelKey) : fallback;
};
const { canCreatePage, getForbiddenMessage } = useStudioCapabilities();

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && !canCreatePage.value) {
      toast.error(getForbiddenMessage("crud.createItem"));
      emit("update:open", false);
    }
  },
);

const title = ref("");
const pageSlug = ref("");
const selectedLayout = ref("__none__");
const startingPoint = ref<PageStartingPoint>("blank");
const parent = ref("__root__");
const isSlugEdited = ref(false);
const isCreating = ref(false);
const errors = ref<Record<string, string>>({});

const availableParents = computed(() =>
  props.pages.filter((p) => p.slug !== "index" && p.systemRole !== "not-found"),
);
const orderedLayouts = computed(() => sortLayoutsForPageSelector(props.layouts));

const startingPointOptions = computed(() => [
  {
    id: "blank" as const,
    label: t("pages.createMode.blank"),
    description: t("pages.createMode.blankDescription"),
    icon: studioIcons.page,
  },
  {
    id: "template" as const,
    label: t("pages.createMode.template"),
    description: t("pages.createMode.templateDescription"),
    icon: studioIcons.layouts,
  },
  {
    id: "ai" as const,
    label: t("pages.createMode.ai"),
    description: t("pages.createMode.aiDescription"),
    icon: studioIcons.sparkles,
  },
]);

function getParentPath(parentSlug: string): string {
  const segments: string[] = [];
  const pageMap = new Map(props.pages.map((p) => [p.slug, p]));
  let currentSlug: string | undefined = parentSlug;
  while (currentSlug) {
    const page = pageMap.get(currentSlug);
    if (!page) break;
    if (page.slug !== "index") segments.unshift(page.slug);
    currentSlug = page.parent;
  }
  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

function updateSlugFromTitle() {
  if (!isSlugEdited.value) {
    pageSlug.value = slugify(title.value);
  }
}

function resetForm() {
  title.value = "";
  pageSlug.value = "";
  selectedLayout.value = "__none__";
  startingPoint.value = "blank";
  parent.value = "__root__";
  isSlugEdited.value = false;
  errors.value = {};
}

function validate(): boolean {
  errors.value = {};
  if (!title.value.trim()) errors.value.title = t("pages.titleRequired");
  return Object.keys(errors.value).length === 0;
}

function selectStartingPoint(value: PageStartingPoint): void {
  startingPoint.value = value;
}

async function submitCreate() {
  if (!validate()) return;
  isCreating.value = true;
  try {
    const slug = await createPage({
      title: title.value.trim(),
      slug: pageSlug.value.trim() || undefined,
      parent: parent.value === "__root__" ? null : parent.value,
      layout: selectedLayout.value === "__none__" ? "" : selectedLayout.value,
    });
    if (slug) {
      emit("created", slug, startingPoint.value, title.value.trim());
      resetForm();
      emit("update:open", false);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t("pages.createFailed"));
  } finally {
    isCreating.value = false;
  }
}

function handleClose(v: boolean) {
  if (!v) resetForm();
  emit("update:open", v);
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
      <DialogHeader class="gap-0">
        <DialogTitle>{{ t("pages.createTitle") }}</DialogTitle>
        <DialogDescription>
          {{ t("pages.createDescription") }}
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-2">
        <Label for="create-title">{{ t("pages.name") }}</Label>
        <Input
          id="create-title"
          v-model="title"
          :placeholder="t('pages.namePlaceholder')"
          :class="errors.title ? 'border-destructive' : ''"
          @input="updateSlugFromTitle"
          @keydown.enter="submitCreate"
        />
        <p v-if="errors.title" class="text-xs text-destructive">
          {{ errors.title }}
        </p>
      </div>
      <div class="grid gap-2">
        <Label for="create-slug">{{ t("pages.slugLabel") }}</Label>
        <Input
          id="create-slug"
          v-model="pageSlug"
          placeholder="about-us"
          @input="isSlugEdited = true"
          @keydown.enter="submitCreate"
        />
      </div>
      <div class="grid gap-2">
        <Label for="create-parent">{{ t("pages.parent") }}</Label>
        <Select v-model="parent">
          <SelectTrigger>
            <SelectValue :placeholder="t('pages.root')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__root__">{{ t("pages.root") }}</SelectItem>
            <SelectItem
              v-for="page in availableParents"
              :key="page.id"
              :value="page.slug"
            >
              {{ page.title }} ({{ getParentPath(page.slug) }})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="grid gap-2">
        <Label for="create-layout">{{ t("pages.pageStructure") }}</Label>
        <Select v-model="selectedLayout">
          <SelectTrigger>
            <SelectValue :placeholder="t('pages.selectLayout')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{{ t("pages.layoutOption.none") }}</SelectItem>
            <SelectItem
              v-for="layout in orderedLayouts"
              :key="layout.id"
              :value="layout.id"
            >
              {{ layoutDisplayName(layout.id, layout.title || layout.name) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="grid gap-2">
        <Label>{{ t("pages.createMode.label") }}</Label>
        <div class="grid grid-cols-3 gap-2" role="group" :aria-label="t('pages.createMode.label')">
          <button
            v-for="option in startingPointOptions"
            :key="option.id"
            type="button"
            :aria-pressed="startingPoint === option.id"
            :class="[
              'flex min-h-24 flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              startingPoint === option.id
                ? 'border-primary bg-primary/8 text-foreground'
                : 'border-border bg-card/30 text-muted-foreground hover:border-border/80 hover:bg-card/60 hover:text-foreground',
            ]"
            @click="selectStartingPoint(option.id)"
          >
            <span class="flex items-center gap-2 text-sm font-medium">
              <span :class="[option.icon, 'size-4 shrink-0']" aria-hidden="true" />
              {{ option.label }}
            </span>
            <span class="text-xs leading-4 text-muted-foreground">
              {{ option.description }}
            </span>
          </button>
        </div>
      </div>
      <DialogFooter>
        <Button variant="destructive" size="lg" @click="handleClose(false)"
          >{{ t("pages.cancel") }}</Button
        >
        <Button
          variant="default"
          :disabled="isCreating"
          size="lg"
          @click="submitCreate"
        >
          {{ isCreating ? t("pages.creating") : t("pages.createTitle") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
