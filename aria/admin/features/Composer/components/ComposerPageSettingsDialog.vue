<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { actions } from "astro:actions";
import { toast } from "vue-sonner";
import type { PageDSL } from "../../../../lib/types/nodes";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioI18n } from "@/i18n";
import {
  systemRoleOptions,
  usePageAccessState,
} from "@/features/Studio/pages/composables/usePageAccessState";
import { updatePageLayout } from "@/features/Studio/pages/utils/updatePageLayout";
import { getLayoutDisplayLabelKey } from "@/features/Studio/pages/utils/layoutDisplayLabel";
import { useStudioCapabilities } from "@/composables/useStudioCapabilities";

interface LayoutOption {
  id: string;
  name: string;
}

interface ParentOption {
  id: string;
  slug: string;
  title: string;
}

const props = defineProps<{
  open: boolean;
  page: PageDSL | null;
  layouts: readonly LayoutOption[];
  pages: readonly ParentOption[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "page-saved": [page: PageDSL];
}>();

const { t } = useStudioI18n();
const { canEditPageStructure } = useStudioCapabilities();
const accessState = usePageAccessState();
const title = ref("");
const slug = ref("");
const description = ref("");
const layout = ref("__none__");
const parent = ref("__root__");
const visibility = ref<NonNullable<PageDSL["visibility"]>>("public");
const isSaving = ref(false);
const isLoadingPolicy = ref(false);
const isCheckingNotFound = ref(false);
const notFoundOverrideOpen = ref(false);
const existingNotFoundPage = ref<{ title?: string; slug?: string } | null>(null);
const orderedLayouts = computed(() =>
  [...props.layouts].sort((a, b) => {
    const order = ["full-width", "left-sidebar", "right-sidebar", "two-sidebar"];
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
  }),
);

watch(
  () => [props.open, props.page?.id] as const,
  async ([open]) => {
    if (!open || !props.page) return;
    title.value = props.page.title;
    slug.value = props.page.slug === "index" ? "/" : props.page.slug;
    description.value = props.page.description ?? "";
    layout.value = props.page.layout || "__none__";
    parent.value = props.page.parent || "__root__";
    visibility.value = props.page.visibility ?? "public";
    isLoadingPolicy.value = true;
    try {
      await accessState.loadPolicy(props.page.slug, { force: true });
    } finally {
      isLoadingPolicy.value = false;
    }
  },
);

function roleLabel(value: string): string {
  const key =
    value === "not-found"
      ? "pages.type.notFound.label"
      : value === "cms-collection"
        ? "pages.type.collection.label"
        : value === "cms-entry"
          ? "pages.type.entry.label"
          : "pages.type.standard.label";
  return t(key);
}

function layoutLabel(option: LayoutOption): string {
  const key = getLayoutDisplayLabelKey(option.id);
  return key ? t(key) : option.name;
}

async function handlePageTypeSelection(value: string | number | null): Promise<void> {
  const selectedRole = systemRoleOptions.find((option) => option.value === value);
  if (!selectedRole || selectedRole.value === accessState.systemRole.value) return;

  if (selectedRole.value !== "not-found") {
    accessState.systemRole.value = selectedRole.value;
    return;
  }

  isCheckingNotFound.value = true;
  try {
    const { data, error } = await actions.pages.listInventory();
    if (error || !data) {
      throw new Error(error?.message ?? t("composer.pageSettings.loadPageFailed"));
    }
    const existing = data.pages.find(
      (candidate) =>
        candidate.systemRole === "not-found" && candidate.slug !== props.page?.slug,
    );
    if (existing) {
      existingNotFoundPage.value = existing;
      notFoundOverrideOpen.value = true;
      return;
    }

    accessState.systemRole.value = "not-found";
    accessState.accessMode.value = "public";
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : t("composer.pageSettings.loadPageFailed"),
    );
  } finally {
    isCheckingNotFound.value = false;
  }
}

function confirmNotFoundOverride(): void {
  accessState.systemRole.value = "not-found";
  accessState.accessMode.value = "public";
  notFoundOverrideOpen.value = false;
  existingNotFoundPage.value = null;
}

function cancelNotFoundOverride(): void {
  notFoundOverrideOpen.value = false;
  existingNotFoundPage.value = null;
}

async function saveSettings(): Promise<void> {
  const current = props.page;
  if (!current?.slug || isSaving.value) return;
  isSaving.value = true;
  try {
    let nextPage: PageDSL = {
      ...current,
      title: title.value.trim() || current.slug,
      slug: slug.value.trim().replace(/^\/+|\/+$/g, "") || "index",
      description: description.value.trim() || undefined,
      parent: parent.value === "__root__" ? undefined : parent.value,
      visibility: visibility.value,
      updatedAt: new Date().toISOString(),
    };

    const nextLayout = layout.value === "__none__" ? "" : layout.value;
    if ((current.layout ?? "") !== nextLayout) {
      const result = await updatePageLayout({
        page: nextPage,
        nextLayoutSlug: nextLayout,
        canEdit: canEditPageStructure.value,
      });
      if (!result.success || !result.nextPage) return;
      nextPage = result.nextPage;
    }

    if (accessState.isPolicyDirty.value) {
      await accessState.savePolicy(current.slug);
    }

    emit("page-saved", nextPage);
    toast.success(t("composer.pageSettings.quickSaveQueued"));
    emit("update:open", false);
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : t("composer.pageSettings.quickSaveFailed"),
    );
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("composer.pageSettings.quickTitle") }}</DialogTitle>
        <DialogDescription>
          {{ t("composer.pageSettings.quickDescription") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="page" class="grid gap-4 sm:grid-cols-2">
        <div class="grid gap-2">
          <Label for="composer-page-title">{{ t("pages.name") }}</Label>
          <Input id="composer-page-title" v-model="title" :disabled="isSaving" />
        </div>
        <div class="grid gap-2">
          <Label for="composer-page-path">{{ t("pages.path") }}</Label>
          <Input id="composer-page-path" v-model="slug" :disabled="isSaving" />
        </div>
        <div class="grid gap-2 sm:col-span-2">
          <Label for="composer-page-description">{{ t("pages.column.description") }}</Label>
          <Textarea id="composer-page-description" v-model="description" rows="3" :disabled="isSaving" />
        </div>

        <div class="grid min-w-0 gap-2">
          <Label>{{ t("pages.pageStructure") }}</Label>
          <Select v-model="layout" :disabled="isSaving">
            <SelectTrigger class="min-w-0"><SelectValue class="min-w-0 truncate" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{{ t("pages.layoutOption.none") }}</SelectItem>
              <SelectItem v-for="option in orderedLayouts" :key="option.id" :value="option.id">
                {{ layoutLabel(option) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid min-w-0 gap-2">
          <Label>{{ t("pages.parent") }}</Label>
          <Select v-model="parent" :disabled="isSaving">
            <SelectTrigger class="min-w-0"><SelectValue class="min-w-0 truncate" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">{{ t("pages.root") }}</SelectItem>
              <SelectItem
                v-for="option in pages.filter((item) => item.slug !== page?.slug)"
                :key="option.id"
                :value="option.slug"
              >
                {{ option.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid min-w-0 gap-2">
          <Label>{{ t("pages.overview.visibility") }}</Label>
          <Select v-model="visibility" :disabled="isSaving">
            <SelectTrigger class="min-w-0"><SelectValue class="min-w-0 truncate" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{{ t("pages.access.public") }}</SelectItem>
              <SelectItem value="private">{{ t("pages.access.private") }}</SelectItem>
              <SelectItem value="unlisted">{{ t("pages.access.unlisted") }}</SelectItem>
              <SelectItem value="draft">{{ t("pages.filter.draft") }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid min-w-0 gap-2">
          <Label>{{ t("pages.type.title") }}</Label>
          <Select
            :model-value="accessState.systemRole.value"
            :disabled="isSaving || isLoadingPolicy || isCheckingNotFound"
            @update:model-value="handlePageTypeSelection"
          >
            <SelectTrigger class="min-w-0"><SelectValue class="min-w-0 truncate" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in systemRoleOptions" :key="option.value" :value="option.value">
                {{ roleLabel(option.value) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
          {{ t("pages.cancel") }}
        </Button>
        <Button :disabled="isSaving || isLoadingPolicy || !page" @click="saveSettings">
          {{ isSaving ? t("common.saving") : t("composer.pageSettings.quickSave") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog :open="notFoundOverrideOpen" @update:open="(open) => !open && cancelNotFoundOverride()">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{{ t("pages.detail.notFoundAssigned") }}</DialogTitle>
        <DialogDescription>
          {{
            t("pages.detail.notFoundOverride", {
              page: existingNotFoundPage?.title ?? existingNotFoundPage?.slug ?? "",
            })
          }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="cancelNotFoundOverride">
          {{ t("pages.cancel") }}
        </Button>
        <Button @click="confirmNotFoundOverride">
          {{ t("pages.detail.overrideNotFound") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
