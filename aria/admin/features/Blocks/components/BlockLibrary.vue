<script setup lang="ts">
/**
 * BlockLibrary Component Displays draggable blocks (primitives and containers) for building pages.
 * Supports both drag-and-drop to canvas and direct click to add.
 */

import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  inject,
  type Component,
  markRaw,
  defineAsyncComponent,
  type Ref,
} from "vue";
import type { z } from "zod";
import { Z_INDEX } from "@/lib/zIndex";
import { useDragDrop } from "../../../composables/useDragDrop";
import { useCanvasDrop } from "../../Stage/dragdrop/useCanvasDrop";
import { useInjectedStageIframeRef } from "../../Core";
import type { AddElementPayload } from "../../../types/app";
import {
  CanvasDropDetailSchema,
  LibraryDragPayloadSchema,
  LibraryElementExposeSchema,
} from "../../Nodes/events/shared/nodeEventSchemas";
import { isEmptyLibraryComponentPayload } from "../../Nodes/events/shared/libraryComponentGuard";
import {
  createIconListNode,
  createListNode,
} from "../../../../lib/blocks/listNodes";
import { createPaginationNode } from "../../../../lib/blocks/paginationNodes";
import { createNavigationNode } from "../../../../lib/blocks/navigationNodes";
import { findPaginationAutoConnectTarget } from "../../../../lib/cms/paginationInspector";
import type { BuilderNode } from "../../../../lib/types/nodes";
import { APP_INJECTION_KEYS } from "../../Core/types/injectionKeys";
import { toStorableJsonObject } from "../../../../lib/schemas/json";
import { log } from "@/lib/utils/logger";
import type { JsonObject } from "../../../../lib/types/nodes";
import { useStudioI18n } from "@/i18n";
import LibraryComponentElement from "./LibraryComponentElement.vue";

const ROOT_DROP_ZONE_ID = "__aria-root__" as const;

const pageBlocks = inject(
  APP_INJECTION_KEYS.pageBlocks,
  ref([]),
) as Ref<BuilderNode[]>;

// Primitives (8 elements)
const TextElement = defineAsyncComponent(
  () => import("../elements/primitives/TextElement.vue"),
);
const HeadingElement = defineAsyncComponent(
  () => import("../elements/primitives/HeadingElement.vue"),
);
const ButtonElement = defineAsyncComponent(
  () => import("../elements/primitives/ButtonElement.vue"),
);
const ImageElement = defineAsyncComponent(
  () => import("../elements/primitives/ImageElement.vue"),
);
const ListElement = defineAsyncComponent(
  () => import("../elements/primitives/ListElement.vue"),
);
const IconListElement = defineAsyncComponent(
  () => import("../elements/primitives/IconListElement.vue"),
);
const LinkElement = defineAsyncComponent(
  () => import("../elements/primitives/LinkElement.vue"),
);
const CodeElement = defineAsyncComponent(
  () => import("../elements/primitives/CodeElement.vue"),
);
const SvgElement = defineAsyncComponent(
  () => import("../elements/primitives/SvgElement.vue"),
);
const IconElement = defineAsyncComponent(
  () => import("../elements/primitives/IconElement.vue"),
);
const VideoElement = defineAsyncComponent(
  () => import("../elements/primitives/VideoElement.vue"),
);
const PaginationElement = defineAsyncComponent(
  () => import("../elements/primitives/PaginationElement.vue"),
);
const NavigationElement = defineAsyncComponent(
  () => import("../elements/primitives/NavigationElement.vue"),
);

// Containers (2 elements)
const ContainerElement = defineAsyncComponent(
  () => import("../elements/containers/ContainerElement.vue"),
);
const SectionElement = defineAsyncComponent(
  () => import("../elements/containers/SectionElement.vue"),
);

interface AvailableComponent {
  id?: string;
  slug?: string;
  name: string;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    viewMode?: "grid" | "list";
    components?: readonly AvailableComponent[];
  }>(),
  { components: () => [] },
);
const { t } = useStudioI18n();

const emit = defineEmits<{
  addElement: [elementData: AddElementPayload];
}>();

const { startDrag, endDrag, dragSource } = useDragDrop();

const stageIframeRef = useInjectedStageIframeRef();
const canvasDrop = useCanvasDrop(stageIframeRef);

interface LibraryElement {
  id: string;
  type: string;
  component: Component;
  componentSlug?: string;
  name?: string;
  icon?: string;
  createData?: () => JsonObject;
}

const containerElements = ref<LibraryElement[]>([
  { id: "section", type: "section", component: markRaw(SectionElement) },
  { id: "container", type: "container", component: markRaw(ContainerElement) },
]);

const componentElements = computed(() =>
  props.components.flatMap((component) => {
    const componentSlug = component.id?.trim() || component.slug?.trim();
    if (!componentSlug) return [];

    return [{
      id: `component-${componentSlug}`,
      type: "component",
      componentSlug,
      name: component.name,
      icon: component.icon || "i-lucide:component",
      component: markRaw(LibraryComponentElement),
      createData: () =>
        toStorableJsonObject({
          type: "Component",
          props: {},
          styles: {},
          children: [],
          reference: { type: "instance", masterId: componentSlug },
        }),
    }];
  }),
);

const primitiveElements = ref<LibraryElement[]>([
  { id: "heading", type: "heading", component: markRaw(HeadingElement) },
  { id: "text", type: "text", component: markRaw(TextElement) },
  { id: "button", type: "button", component: markRaw(ButtonElement) },
  { id: "image", type: "image", component: markRaw(ImageElement) },
  { id: "video", type: "video", component: markRaw(VideoElement) },
  { id: "icon", type: "icon", component: markRaw(IconElement) },
  {
    id: "icon-list",
    type: "list",
    component: markRaw(IconListElement),
    createData: () =>
      toStorableJsonObject(
        createIconListNode({
          items: ["First item", "Second item", "Third item"],
        }),
      ),
  },
  { id: "svg", type: "svg", component: markRaw(SvgElement) },
  {
    id: "list",
    type: "list",
    component: markRaw(ListElement),
    createData: () =>
      toStorableJsonObject(
        createListNode({
          ordered: false,
          items: ["First item", "Second item", "Third item"],
        }),
      ),
  },
  { id: "link", type: "link", component: markRaw(LinkElement) },
  { id: "code", type: "code", component: markRaw(CodeElement) },
  {
    id: "pagination",
    type: "pagination",
    component: markRaw(PaginationElement),
    createData: () => toStorableJsonObject(createPaginationNode()),
  },
  {
    id: "navigation",
    type: "navigation",
    component: markRaw(NavigationElement),
    createData: () => toStorableJsonObject(createNavigationNode()),
  },
]);

type LibraryElementExpose = z.infer<typeof LibraryElementExposeSchema>;

const elementRefs = ref<Record<string, LibraryElementExpose>>({});

function resolveElementPayload(element: LibraryElement): {
  type: string;
  data: JsonObject;
  componentSlug?: string;
} {
  const generatedData = element.createData?.();
  if (generatedData) {
    return {
      type: element.type,
      data: { type: element.type, ...generatedData },
      componentSlug: element.componentSlug,
    };
  }

  const componentRef = elementRefs.value[element.id];
  if (componentRef?.elementMeta && componentRef.elementData) {
    const { elementMeta, elementData } = componentRef;
    return {
      type: elementMeta.type,
      data: { type: elementMeta.type, ...elementData },
      componentSlug: element.componentSlug,
    };
  }

  return {
    type: element.type,
    data: { type: element.type },
    componentSlug: element.componentSlug,
  };
}

function handleDragStart(element: LibraryElement, evt: DragEvent): void {
  const { type, data, componentSlug } = resolveElementPayload(element);
  const parsedPayload = LibraryDragPayloadSchema.safeParse({
    ...data,
    ...(componentSlug ? { componentSlug } : {}),
  });

  if (!parsedPayload.success) {
    log("warn", "[BlockLibrary] Invalid drag payload", {
      issues: parsedPayload.error.issues,
    });
    return;
  }

  const elementData = parsedPayload.data;

  if (evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = "copy";
    evt.dataTransfer.setData("application/json", JSON.stringify(elementData));
    evt.dataTransfer.setData("text/plain", type);

    const ghostEl = document.createElement("div");
    ghostEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      padding: 8px 12px;
      background: var(--popover);
      color: var(--primary);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: 600;
      pointer-events: none;
      z-index: ${Z_INDEX.dragGhost};
      white-space: nowrap;
      opacity: 0.70;
    `;
    ghostEl.textContent = `+ ${type}`;
    document.body.appendChild(ghostEl);
    evt.dataTransfer.setDragImage(ghostEl, 8, 8);
    setTimeout(() => ghostEl.remove(), 0);
  }

  startDrag("add-elements", elementData);

  if (stageIframeRef.value) {
    canvasDrop.startDrag(elementData);
  }
}

function handleDragEnd(): void {
  endDrag();
  canvasDrop.endDrag();
}

function handleCanvasDrop(event: Event): void {
  if (dragSource.value !== "add-elements") {
    return;
  }

  if (!(event instanceof CustomEvent)) {
    return;
  }

  const parsedDrop = CanvasDropDetailSchema.safeParse(event.detail);
  if (!parsedDrop.success) {
    if (import.meta.env.DEV) {
      log("warn", "[BlockLibrary] Ignoring invalid canvas:drop detail", {
        issues: parsedDrop.error.issues,
      });
    }
    return;
  }

  const { zone, data, insertionIndex } = parsedDrop.data;
  let payload = data;

  if (payload.type?.toLowerCase() === "pagination") {
    const targetNodeId = findPaginationAutoConnectTarget({
      pageBlocks: pageBlocks.value,
      parentId: zone.id === ROOT_DROP_ZONE_ID ? null : zone.id,
      insertionIndex,
    });
    if (targetNodeId) {
      payload = {
        ...payload,
        dataSource: {
          type: "pagination",
          targetNodeId,
        },
      };
    }
  }

  if (isEmptyLibraryComponentPayload(payload.type, payload)) {
    emit("addElement", { type: payload.type, data: payload });
    return;
  }

  emit("addElement", {
    type: payload.type,
    data: payload,
    ...(typeof payload.componentSlug === "string"
      ? { componentSlug: payload.componentSlug }
      : {}),
    parentId: zone.id === ROOT_DROP_ZONE_ID ? undefined : zone.id,
    insertionMode: zone.id === ROOT_DROP_ZONE_ID ? "root" : "parent",
    position: insertionIndex,
  });
}

onMounted(() => {
  window.addEventListener("canvas:drop", handleCanvasDrop);
});

onUnmounted(() => {
  window.removeEventListener("canvas:drop", handleCanvasDrop);
  endDrag();
  canvasDrop.destroy();
});

function setElementRef(elementId: string, refValue: unknown): void {
  const parsed = LibraryElementExposeSchema.safeParse(refValue);
  if (parsed.success) {
    elementRefs.value[elementId] = parsed.data;
  }
}

function handleAddElement(element: LibraryElement): void {
  const { type, data, componentSlug } = resolveElementPayload(element);
  emit("addElement", {
    type,
    data,
    ...(componentSlug ? { componentSlug } : {}),
  });
}
</script>

<template>
  <div class="flex-1 flex-col h-full w-64">
    <!-- Elements List -->
    <div class="flex-1 overflow-y-auto space-y-6 p-2">
      <!-- Containers Section -->
      <div>
        <div class="flex items-center justify-between mb-2 px-1 mt-1">
          <span
            class="text-2xs uppercase font-semibold text-muted-foreground/80 tracking-wider"
          >
            Containers
          </span>
        </div>

        <div
          :class="
            (props.viewMode || 'grid') === 'grid'
              ? 'grid grid-cols-2 gap-2'
              : 'space-y-2'
          "
        >
          <div
            v-for="element in containerElements"
            :key="element.id"
            :data-block-library-id="element.id"
            draggable="true"
            @dragstart="handleDragStart(element, $event)"
            @dragend="handleDragEnd"
            @click="handleAddElement(element)"
            class="cursor-move hover:opacity-80 transition-opacity duration-75"
          >
            <component
              :is="element.component"
              :view-mode="props.viewMode"
              :ref="(refValue: unknown) => setElementRef(element.id, refValue)"
            />
          </div>
        </div>
      </div>

      <!-- Reusable components are available as content blocks under their own section. -->
      <div>
        <div class="mb-2 mt-1 flex items-center justify-between px-1">
          <span
            class="text-2xs uppercase font-semibold text-muted-foreground/80 tracking-wider"
          >
            {{ t("components.title") }}
          </span>
        </div>

        <div
          v-if="componentElements.length"
          :class="
            (props.viewMode || 'grid') === 'grid'
              ? 'grid grid-cols-2 gap-2'
              : 'space-y-2'
          "
        >
          <div
            v-for="element in componentElements"
            :key="element.id"
            :data-block-library-id="element.id"
            draggable="true"
            class="cursor-move transition-opacity duration-75 hover:opacity-80"
            @dragstart="handleDragStart(element, $event)"
            @dragend="handleDragEnd"
            @click="handleAddElement(element)"
          >
            <component
              :is="element.component"
              :icon="element.icon"
              :label="element.name"
              :view-mode="props.viewMode"
            />
          </div>
        </div>
        <p v-else class="px-2 py-1 text-xs text-muted-foreground">
          {{ t("components.picker.emptyLibraryTitle") }}
        </p>
      </div>

      <!-- Primitives Section -->
      <div>
        <div class="flex items-center justify-between mb-2 px-1">
          <span
            class="text-2xs uppercase font-semibold text-muted-foreground/80 tracking-wider"
          >
            Primitives
          </span>
        </div>

        <div
          :class="
            (props.viewMode || 'grid') === 'grid'
              ? 'grid grid-cols-2 gap-2'
              : 'space-y-2'
          "
        >
          <div
            v-for="element in primitiveElements"
            :key="element.id"
            :data-block-library-id="element.id"
            draggable="true"
            @dragstart="handleDragStart(element, $event)"
            @dragend="handleDragEnd"
            @click="handleAddElement(element)"
            class="cursor-move hover:opacity-80 transition-opacity"
          >
            <component
              :is="element.component"
              :view-mode="props.viewMode"
              :ref="(refValue: unknown) => setElementRef(element.id, refValue)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
