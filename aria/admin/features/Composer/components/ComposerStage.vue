<script setup lang="ts">
import { ref } from "vue";
import DesignStage from "../../Design/components/DesignStage.vue";
import StageFrame from "../../Stage/components/StageFrame.vue";
import type { BuilderNode, LayoutDSL } from "../../../../lib/types/nodes";
import type { StageSelectBlockInput } from "../../Stage/types";

const props = defineProps<{
  activeView?: "builder" | "options" | "styles";
  currentItemType: "page" | "layout" | "component";
  currentItemSlug?: string;
  headerComponent?: string;
  footerComponent?: string;
  expandedBlocks: BuilderNode[]; // Expanded tree with component references resolved
  showOutlines?: boolean;
  showSelectionSizing?: boolean;
  showSelectionToolbar?: boolean;
  wireframeMode?: boolean;
  showHtmlSections?: boolean;
  pageSlug?: string | null;
  currentLayout?: LayoutDSL | null;
}>();

const emit = defineEmits<{
  closeStyles: [];
  selectBlock: [selection: StageSelectBlockInput];
  addElement: [payload: import("../../../types/app").AddElementPayload];
  addFirstElement: [];
  mergeGridCells: [payload: import("../../../types/app").GridCellMergePayload];
  addBlock: [block: BuilderNode, parentId: string | null, insertionIndex?: number];
  addBlocks: [blocks: BuilderNode[], parentId: string | null, insertionIndices: number[], gridMutation?: { rows: number; columns: number; existingPlacements: Array<{ nodeId: string; row: number; column: number; rowSpan: number; columnSpan: number }> }];
  deleteBlock: [id: string];
  duplicateBlock: [nodeId: string];
  detachComponent: [nodeId: string];
  replaceBlockWithComponent: [nodeId: string, componentSlug: string];
  editComponent: [componentId: string];
  reorderBlock: [
    operation: {
      sourceParentId: string | null;
      sourceIndex: number;
      targetParentId: string | null;
      targetIndex: number;
    },
  ];
  openPicker: [slotName: string];
  editLayoutRegion: [regionId: string];
  ready: [];
}>();

// Expose StageFrame ref for cross-iframe drag-drop
const stageFrameRef = ref<InstanceType<typeof StageFrame> | null>(null);
defineExpose({ stageFrameRef });

</script>

<template>
  <div class="relative w-full h-full flex flex-col">
    <DesignStage
      v-if="props.activeView === 'styles'"
      key="styles"
      @close="emit('closeStyles')"
    />

    <div v-else key="builder" class="relative w-full h-full flex flex-col">
      <StageFrame
        ref="stageFrameRef"
        :blocks="props.expandedBlocks"
        :current-layout="props.currentLayout"
        :current-item-type="props.currentItemType"
        :current-item-slug="props.currentItemSlug"
        :show-outlines="props.showOutlines"
        :show-selection-sizing="props.showSelectionSizing"
        :show-selection-toolbar="props.showSelectionToolbar"
        :wireframe-mode="props.wireframeMode"
        :show-html-sections="props.showHtmlSections"
        @ready="emit('ready')"
        @select-block="(id) => emit('selectBlock', id)"
        @add-element="emit('addElement', $event)"
        @add-first-element="emit('addFirstElement')"
        @merge-grid-cells="emit('mergeGridCells', $event)"
        @add-block="(block, parentId, insertionIndex) => emit('addBlock', block, parentId, insertionIndex)"
        @add-blocks="(blocks, parentId, insertionIndices, gridMutation) => emit('addBlocks', blocks, parentId, insertionIndices, gridMutation)"
        @delete-block="(id) => emit('deleteBlock', id)"
        @duplicate-block="(nodeId) => emit('duplicateBlock', nodeId)"
        @detach-component="(nodeId) => emit('detachComponent', nodeId)"
        @replace-block-with-component="
          (nodeId, componentSlug) =>
            emit('replaceBlockWithComponent', nodeId, componentSlug)
        "
        @edit-component="(componentId) => emit('editComponent', componentId)"
        @reorder-block="(operation) => emit('reorderBlock', operation)"
        @open-picker="(slotName) => emit('openPicker', slotName)"
      />
    </div>
  </div>
</template>
