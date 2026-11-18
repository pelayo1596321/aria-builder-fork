<script setup lang="ts">
/**
 * CanvasOverlayLayer. vue Parent-level overlay component that renders
 * all visual overlays for the canvas.
 */

import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  watch,
  watchEffect,
  type CSSProperties,
} from "vue";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-picker";
import { useToolbarTextColorContext } from "../composables/useToolbarTextColorContext";
import {
  useCanvasOverlays,
  TOOLBAR_ICONS,
  type CanvasAffordanceDescriptor,
  type ToolbarActionName,
} from "../../../composables/useCanvasOverlays";
import { OVERLAY_Z_INDEX } from "@/lib/zIndex";
import { studioIcons } from "@/lib/icons";
import { getContentHeadingLevel } from "../../Inspector/composables/useContentContract";
import { useSelectedNodeState } from "../../Core/composables/useSelectedNodeState";
import { usePropertySave } from "../../Core";
import { useCanvasSignalBridge } from "../../Core/composables/useCanvasSignalBridge";
import { useDragDrop } from "../../../composables/useDragDrop";
import { useInspectorStyleTargetWithGlobalDefaults } from "../../Inspector/composables/useInspectorStyleTargetWithGlobalDefaults";
import { useInspectorState } from "../../Inspector/composables/useInspectorState";
import ToolbarHeadingLevelPicker from "./ToolbarHeadingLevelPicker.vue";
import SelectionToolbarCmsControls from "./SelectionToolbarCmsControls.vue";
import SelectionToolbarMotionControl from "./SelectionToolbarMotionControl.vue";
import { useStudioI18n } from "@/i18n";
import { resolveCanvasAffordanceVisualLayout } from "../utils/canvasAffordanceLayout";
import { shouldHideSelectionToolbar } from "../utils/selectionToolbarVisibility";
import { APP_INJECTION_KEYS } from "../../Core/types/injectionKeys";
import type { BuilderNode } from "../../../../lib/types/nodes";
import type { AddElementPayload } from "../../../types/app";
import {
  getQuickAddElements,
  QUICK_ADD_USAGE_CHANGED_EVENT,
  type QuickAddElement,
} from "../../Blocks/composables/quickAddElements";
import {
  CANVAS_GRID_DIMENSIONS,
  CANVAS_GRID_PRESETS,
  CANVAS_QUICK_TOOLS_KEY,
} from "../composables/useCanvasQuickToolsContext";
import {
  CANVAS_SELECTION_RESIZE_HANDLES,
  canvasSelectionResizeAxes,
  canvasSelectionResizeCursor,
  formatCanvasSelectionSize,
  getCanvasSelectionScale,
  measureCanvasSelectionElement,
  resizeCanvasSelection,
  type CanvasSelectionResizeHandle,
  type CanvasSelectionSize,
} from "../utils/canvasSelectionResize";

// PROPS & EMITS

const props = withDefaults(
  defineProps<{
    iframeRef?: HTMLIFrameElement | null;
    currentItemType?: "page" | "layout" | "component";
    currentItemSlug?: string;
    showSelectionSizing?: boolean;
    showSelectionToolbar?: boolean;
  }>(),
  {
    showSelectionSizing: true,
    showSelectionToolbar: true,
  },
);

const emit = defineEmits<{
  (e: "toolbar-action", action: ToolbarActionName, nodeId: string): void;
  (
    e: "toolbar-style-change",
    property: string,
    value: string,
    nodeId: string,
  ): void;
  (
    e: "toolbar-props-change",
    updates: Record<string, unknown>,
    nodeId: string,
  ): void;
  (e: "select-affordance", descriptor: CanvasAffordanceDescriptor): void;
  (e: "add-element", payload: AddElementPayload): void;
  (e: "open-add-elements"): void;
  (e: "grid-action", payload: { gridId: string; cellId?: string; edge?: "north" | "east" | "south" | "west"; action: "resize" | "insert-row" | "insert-column" | "merge"; rows?: number; columns?: number; neighborId?: string; placement?: { row: number; column: number; rowSpan?: number; columnSpan?: number }; placements?: Array<{ row: number; column: number; rowSpan: number; columnSpan: number; insertionIndex: number }>; gridMutation?: { rows: number; columns: number; existingPlacements: Array<{ nodeId: string; row: number; column: number; rowSpan: number; columnSpan: number }> } }): void;
  (e: "ready"): void;
}>();
const { t } = useStudioI18n();

const { selectedNode, isMultiSelect } = useSelectedNodeState();
const quickAddMenuOpen = ref(false);
const quickAddSearchQuery = ref("");
const quickAddUsageRevision = ref(0);
const quickAddElements = computed(() => {
  quickAddUsageRevision.value;
  return getQuickAddElements();
});
const filteredQuickAddElements = computed(() => {
  const query = quickAddSearchQuery.value.trim().toLocaleLowerCase();
  if (!query) return quickAddElements.value;
  return quickAddElements.value.filter((element) =>
    `${element.label} ${element.type}`.toLocaleLowerCase().includes(query),
  );
});
const selectedEmptyContainer = computed(() => {
  const node = selectedNode.value;
  return Boolean(
    overlays.selection.visible &&
      !isMultiSelect.value &&
      node &&
      node.type?.toLowerCase() === "container" &&
      (node.children?.length ?? 0) === 0,
  );
});
const visibleAffordances = computed(() =>
  overlays.affordances.filter(
    (affordance) =>
      !(
        selectedEmptyContainer.value &&
        affordance.kind === "empty-node" &&
        affordance.nodeId === selectedNode.value?.id
      ),
  ),
);
const emptyContainerCenterStyle = computed((): CSSProperties => {
  const position = overlays.selection.position;
  if (!position) return { display: "none" };
  return {
    position: "fixed",
    left: `${position.left + position.width / 2}px`,
    top: `${position.top + position.height / 2}px`,
    transform: "translate(-50%, -50%)",
    zIndex: 1003,
  };
});
const quickAddPanelStyle = computed((): CSSProperties => {
  const position = overlays.selection.position;
  if (!position) return { display: "none" };
  const margin = 12;
  const panelWidth = Math.min(304, window.innerWidth - margin * 2);
  const centerX = Math.min(
    window.innerWidth - panelWidth / 2 - margin,
    Math.max(panelWidth / 2 + margin, position.left + position.width / 2),
  );
  const panelHeight = Math.min(360, window.innerHeight - margin * 2);
  const centerY = Math.min(
    window.innerHeight - panelHeight / 2 - margin,
    Math.max(panelHeight / 2 + margin, position.top + position.height / 2),
  );
  return {
    position: "fixed",
    left: `${centerX}px`,
    top: `${centerY}px`,
    transform: "translate(-50%, -50%)",
    width: `${panelWidth}px`,
    zIndex: 1004,
  };
});

function addElementToSelectedContainer(element: QuickAddElement): void {
  const parentId = selectedEmptyContainer.value ? selectedNode.value?.id : undefined;
  if (!parentId) return;
  emit("add-element", {
    type: element.type,
    data: element.createData(),
    parentId,
    insertionMode: "parent",
    position: 0,
  });
  quickAddMenuOpen.value = false;
  quickAddSearchQuery.value = "";
}

function openAllElements(): void {
  quickAddMenuOpen.value = false;
  quickAddSearchQuery.value = "";
  emit("open-add-elements");
}

function refreshQuickAddElements(): void {
  quickAddUsageRevision.value += 1;
}

const pageBlocks = inject(APP_INJECTION_KEYS.pageBlocks, null);
const canvasQuickTools = inject(CANVAS_QUICK_TOOLS_KEY, null);
const quickSelectionSize = computed(
  () => canvasQuickTools?.value.selectionSizeLabel ?? "",
);
const propertySave = usePropertySave();
const { styleTarget: resizeStyleTarget } =
  useInspectorStyleTargetWithGlobalDefaults({ propertySave });
const inspectorState = useInspectorState();
const { signalStyleUpdate } = useCanvasSignalBridge();
const { isDragging, dragSource } = useDragDrop();
const GRID_EDGES = ["north", "east", "south", "west"] as const;

function responsiveBase(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.base ?? Object.values(record)[0] ?? "");
  }
  return "";
}

function gridTrackCount(value: unknown, fallback: number): number {
  const source = responsiveBase(value).trim();
  const repeat = source.match(/repeat\(\s*(\d+)/i);
  return repeat ? Math.max(1, Number(repeat[1])) : source ? source.split(/\s+/).length : Math.max(1, fallback);
}

const quickStackTarget = computed(() => {
  const node = selectedNode.value;
  if (!node || isMultiSelect.value) return null;
  const isGrid = (candidate: typeof node) => candidate?.type?.toLowerCase() === "container" && responsiveBase(candidate.styles?.display) === "grid";
  if (isGrid(node)) return node;
  if (node.type?.toLowerCase() === "section") return node.children?.find(isGrid) ?? null;
  return null;
});

function findBuilderNodeById(nodes: readonly BuilderNode[], nodeId: string): BuilderNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const nested = findBuilderNodeById(node.children ?? [], nodeId);
    if (nested) return nested;
  }
  return null;
}

async function waitForBuilderNode(nodeId: string, childCount?: number): Promise<BuilderNode | null> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const node = findBuilderNodeById(pageBlocks?.value ?? [], nodeId);
    if (node && (childCount === undefined || node.children?.length === childCount)) return node;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
  return findBuilderNodeById(pageBlocks?.value ?? [], nodeId);
}

async function restoreGridToolsSelection(nodeId: string | undefined): Promise<void> {
  if (!nodeId || selectedNode.value?.id === nodeId) return;
  const node = findBuilderNodeById(pageBlocks?.value ?? [], nodeId);
  const document = props.iframeRef?.contentDocument;
  const element = Array.from(document?.querySelectorAll<HTMLElement>("[data-aria-id]") ?? [])
    .find((candidate) => candidate.getAttribute("data-aria-id") === nodeId);
  if (!node || !element) return;
  overlays.showSelection(element, nodeId, node.type);
}

const quickStackDimensions = computed(() => {
  const target = quickStackTarget.value;
  const count = target?.children?.length ?? 1;
  const columns = gridTrackCount(target?.styles?.gridTemplateColumns, Math.ceil(Math.sqrt(count)));
  return { columns, rows: gridTrackCount(target?.styles?.gridTemplateRows, Math.ceil(count / columns)) };
});
const CANVAS_GRID_LAYOUT_PRESETS = [
  {
    id: "three-by-two-grid",
    label: "Three columns, two rows",
    columns: 3,
    rows: 2,
    cells: [
      { column: "1", row: "1" },
      { column: "2", row: "1" },
      { column: "3", row: "1" },
      { column: "1", row: "2" },
      { column: "2", row: "2" },
      { column: "3", row: "2" },
    ],
  },
  {
    id: "left-stack-right-full",
    label: "Left column stacked, right column full height",
    columns: 2,
    rows: 2,
    cells: [
      { column: "1", row: "1" },
      { column: "1", row: "2" },
      { column: "2", row: "1 / span 2" },
    ],
  },
  {
    id: "left-full-right-stack",
    label: "Left column full height, right column stacked",
    columns: 2,
    rows: 2,
    cells: [
      { column: "1", row: "1 / span 2" },
      { column: "2", row: "1" },
      { column: "2", row: "2" },
    ],
  },
  {
    id: "diagonal-four-cells",
    label: "Four-cell diagonal layout",
    columns: 3,
    rows: 2,
    cells: [
      { column: "1 / span 2", row: "1" },
      { column: "3", row: "1" },
      { column: "1", row: "2" },
      { column: "2 / span 2", row: "2" },
    ],
  },
] as const;
const gridToolsPanelRef = ref<HTMLElement | null>(null);
const gridToolsOffset = ref({ x: 0, y: 0 });
const gridToolsDrag = ref<{
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
} | null>(null);
const hoveredGridEdge = ref<"north" | "east" | "south" | "west" | null>(null);
const hoveredGridMergeEdge = ref<"north" | "east" | "south" | "west" | null>(null);

function startGridToolsDrag(event: PointerEvent): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement | null;
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  handle.setPointerCapture(event.pointerId);
  gridToolsDrag.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: gridToolsOffset.value.x,
    startOffsetY: gridToolsOffset.value.y,
  };
}

function moveGridToolsDrag(event: PointerEvent): void {
  const drag = gridToolsDrag.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();

  const position = overlays.selection.position;
  const panelRect = gridToolsPanelRef.value?.getBoundingClientRect();
  if (!position || !panelRect) return;

  const anchorX = position.left + position.width / 2;
  const anchorY = position.top + position.height / 2;
  const desiredX = anchorX + drag.startOffsetX + event.clientX - drag.startX;
  const desiredY = anchorY + drag.startOffsetY + event.clientY - drag.startY;
  const margin = 8;
  const minX = Math.min(window.innerWidth / 2, panelRect.width / 2 + margin);
  const maxX = Math.max(window.innerWidth / 2, window.innerWidth - panelRect.width / 2 - margin);
  const minY = Math.min(window.innerHeight / 2, panelRect.height / 2 + margin);
  const maxY = Math.max(window.innerHeight / 2, window.innerHeight - panelRect.height / 2 - margin);
  const centerX = Math.min(maxX, Math.max(minX, desiredX));
  const centerY = Math.min(maxY, Math.max(minY, desiredY));

  gridToolsOffset.value = { x: centerX - anchorX, y: centerY - anchorY };
}

function endGridToolsDrag(event: PointerEvent): void {
  if (gridToolsDrag.value?.pointerId !== event.pointerId) return;
  gridToolsDrag.value = null;
  const handle = event.currentTarget as HTMLElement | null;
  if (handle?.hasPointerCapture(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
}

const selectedGridCell = computed(() => {
  const element = overlays.selection.element as HTMLElement | null;
  const node = selectedNode.value;
  if (!element || !node || node.type?.toLowerCase() !== "container") return null;
  const parent = element.parentElement?.closest<HTMLElement>("[data-aria-id]");
  const gridId = parent?.getAttribute("data-aria-id");
  if (!parent || !gridId || gridId === node.id) return null;
  const findNode = (nodes: BuilderNode[], id: string): BuilderNode | null => {
    for (const entry of nodes ?? []) {
      if (entry.id === id) return entry;
      const nested = findNode(entry.children, id);
      if (nested) return nested;
    }
    return null;
  };
  const grid = findNode(pageBlocks?.value ?? [], gridId);
  if (!grid || responsiveBase(grid.styles?.display) !== "grid") return null;
  const children = grid.children ?? [];
  const index = children.findIndex((child) => child.id === node.id);
  if (index < 0) return null;
  const columns = gridTrackCount(grid.styles?.gridTemplateColumns, Math.ceil(Math.sqrt(children.length || 1)));
  const rows = gridTrackCount(grid.styles?.gridTemplateRows, Math.ceil((children.length || 1) / columns));
  const placements = children.map((child, childIndex) => {
    const column = parseGridAxis(child.styles?.gridColumn, childIndex % columns);
    const row = parseGridAxis(child.styles?.gridRow, Math.floor(childIndex / columns));
    return { column: column.start, row: row.start, columnSpan: column.span, rowSpan: row.span };
  });
  const placement = placements[index];
  return {
    grid,
    node,
    children,
    index,
    row: placement.row,
    column: placement.column,
    rowSpan: placement.rowSpan,
    columnSpan: placement.columnSpan,
    placements,
    columns,
    rows,
    cellElement: element,
    gridElement: parent,
  };
});

const gridInsertionGuideStyle = computed((): CSSProperties => {
  const edge = hoveredGridEdge.value;
  const cell = selectedGridCell.value;
  const iframe = props.iframeRef;
  if (!edge || !cell || !iframe) return { display: "none" };

  const frameRect = iframe.getBoundingClientRect();
  const scaleX = iframe.clientWidth > 0 ? frameRect.width / iframe.clientWidth : 1;
  const scaleY = iframe.clientHeight > 0 ? frameRect.height / iframe.clientHeight : 1;
  const cellRect = cell.cellElement.getBoundingClientRect();
  const gridRect = cell.gridElement.getBoundingClientRect();
  const gridStyle = iframe.contentWindow?.getComputedStyle(cell.gridElement);
  const columnGap = Number.parseFloat(gridStyle?.columnGap ?? "") || 0;
  const rowGap = Number.parseFloat(gridStyle?.rowGap ?? "") || 0;
  const gridCells = Array.from(cell.gridElement.children).filter((child) =>
    child.hasAttribute("data-aria-id"),
  );
  const cellRects = gridCells.map((child) => child.getBoundingClientRect());
  const left = cellRects.length
    ? Math.min(...cellRects.map((rect) => rect.left))
    : gridRect.left;
  const right = cellRects.length
    ? Math.max(...cellRects.map((rect) => rect.right))
    : gridRect.right;
  const top = cellRects.length
    ? Math.min(...cellRects.map((rect) => rect.top))
    : gridRect.top;
  const bottom = cellRects.length
    ? Math.max(...cellRects.map((rect) => rect.bottom))
    : gridRect.bottom;
  const horizontal = edge === "north" || edge === "south";
  const localLeft = horizontal
    ? left
    : edge === "west" ? cellRect.left - columnGap / 2 : cellRect.right + columnGap / 2;
  const localTop = horizontal
    ? edge === "north" ? cellRect.top - rowGap / 2 : cellRect.bottom + rowGap / 2
    : top;

  return {
    position: "fixed",
    left: `${frameRect.left + localLeft * scaleX - (horizontal ? 0 : 2)}px`,
    top: `${frameRect.top + localTop * scaleY - (horizontal ? 2 : 0)}px`,
    width: `${(horizontal ? right - left : 4) * scaleX}px`,
    height: `${(horizontal ? 4 : bottom - top) * scaleY}px`,
    zIndex: OVERLAY_Z_INDEX.selection - 1,
  };
});

function clearGridInsertionGuide(): void {
  hoveredGridEdge.value = null;
  hoveredGridMergeEdge.value = null;
  window.removeEventListener("pointermove", handleGridGuideHostPointerMove);
}

function activateGridInsertionGuide(edge: "north" | "east" | "south" | "west"): void {
  hoveredGridEdge.value = edge;
  window.addEventListener("pointermove", handleGridGuideHostPointerMove);
}

function gridEdgeControlStyle(edge: "north" | "east" | "south" | "west"): CSSProperties {
  const cell = selectedGridCell.value;
  const iframe = props.iframeRef;
  if (!cell || !iframe) return { display: "none" };

  const frameRect = iframe.getBoundingClientRect();
  const scaleX = iframe.clientWidth > 0 ? frameRect.width / iframe.clientWidth : 1;
  const scaleY = iframe.clientHeight > 0 ? frameRect.height / iframe.clientHeight : 1;
  const cellRect = cell.cellElement.getBoundingClientRect();
  const gridStyle = iframe.contentWindow?.getComputedStyle(cell.gridElement);
  const columnGap = Number.parseFloat(gridStyle?.columnGap ?? "") || 0;
  const rowGap = Number.parseFloat(gridStyle?.rowGap ?? "") || 0;
  const centerX = edge === "east"
    ? frameRect.left + (cellRect.right + columnGap / 2) * scaleX
    : edge === "west"
      ? frameRect.left + (cellRect.left - columnGap / 2) * scaleX
      : frameRect.left + (cellRect.left + cellRect.width / 2) * scaleX;
  const centerY = edge === "north"
    ? frameRect.top + (cellRect.top - rowGap / 2) * scaleY
    : edge === "south"
      ? frameRect.top + (cellRect.bottom + rowGap / 2) * scaleY
      : frameRect.top + (cellRect.top + cellRect.height / 2) * scaleY;

  return {
    position: "fixed",
    left: `${centerX - 16}px`,
    top: `${centerY - 16}px`,
  };
}

function handleGridGuideHostPointerMove(event: PointerEvent): void {
  const target = event.target as Element | null;
  if (target?.closest("[data-grid-edge-control]")) return;
  clearGridInsertionGuide();
}

function getGridNeighborIndex(edge: "north" | "east" | "south" | "west"): number | null {
  const cell = selectedGridCell.value;
  if (!cell) return null;
  const { row, column, rowSpan, columnSpan, placements } = cell;
  const neighborRow = edge === "north" ? row - 1 : edge === "south" ? row + rowSpan : row;
  const neighborColumn = edge === "west" ? column - 1 : edge === "east" ? column + columnSpan : column;
  if (neighborRow < 0 || neighborRow >= cell.rows || neighborColumn < 0 || neighborColumn >= cell.columns) return null;
  const neighborIndex = placements.findIndex((placement) =>
    neighborRow >= placement.row && neighborRow < placement.row + placement.rowSpan
    && neighborColumn >= placement.column && neighborColumn < placement.column + placement.columnSpan,
  );
  const neighbor = neighborIndex >= 0 ? cell.children[neighborIndex] : null;
  const placement = cell.placements[neighborIndex];
  if (!neighbor || !placement || neighbor.children?.length) return null;

  if (edge === "east") {
    return placement.column === column + columnSpan
      && placement.row === row
      && placement.rowSpan === rowSpan ? neighborIndex : null;
  }
  if (edge === "west") {
    return placement.column + placement.columnSpan === column
      && placement.row === row
      && placement.rowSpan === rowSpan ? neighborIndex : null;
  }
  if (edge === "south") {
    return placement.row === row + rowSpan
      && placement.column === column
      && placement.columnSpan === columnSpan ? neighborIndex : null;
  }
  return placement.row + placement.rowSpan === row
    && placement.column === column
    && placement.columnSpan === columnSpan ? neighborIndex : null;
}

function hasGridNeighbor(edge: "north" | "east" | "south" | "west"): boolean {
  return getGridNeighborIndex(edge) !== null;
}

const gridMergePreviewStyle = computed((): CSSProperties => {
  const edge = hoveredGridMergeEdge.value;
  const cell = selectedGridCell.value;
  const iframe = props.iframeRef;
  const neighborIndex = edge ? getGridNeighborIndex(edge) : null;
  if (neighborIndex === null || !cell || !iframe) return { display: "none" };

  const neighbor = cell.children[neighborIndex];
  const neighborElement = Array.from(cell.gridElement.children).find((child) =>
    child.getAttribute("data-aria-id") === neighbor?.id,
  );
  if (!neighborElement) return { display: "none" };

  const frameRect = iframe.getBoundingClientRect();
  const scaleX = iframe.clientWidth > 0 ? frameRect.width / iframe.clientWidth : 1;
  const scaleY = iframe.clientHeight > 0 ? frameRect.height / iframe.clientHeight : 1;
  const rect = neighborElement.getBoundingClientRect();
  return {
    position: "fixed",
    left: `${frameRect.left + rect.left * scaleX}px`,
    top: `${frameRect.top + rect.top * scaleY}px`,
    width: `${rect.width * scaleX}px`,
    height: `${rect.height * scaleY}px`,
    zIndex: OVERLAY_Z_INDEX.markupPreview + 1,
  };
});

function parseGridAxis(value: unknown, fallbackStart: number): { start: number; span: number } {
  const source = responsiveBase(value).trim();
  const [startText, endText] = source.split("/").map((part) => part.trim());
  const spanMatch = (endText ?? startText).match(/^span\s+(\d+)/i);
  const span = spanMatch ? Math.max(1, Number(spanMatch[1])) : 1;
  const start = Number.parseInt(startText, 10);
  if (!Number.isFinite(start)) return { start: fallbackStart, span };
  if (spanMatch) return { start: Math.max(0, start - 1), span };
  const end = Number.parseInt(endText ?? "", 10);
  return { start: Math.max(0, start - 1), span: Number.isFinite(end) ? Math.max(1, end - start) : 1 };
}

function gridPlacementStyle(start: number, span: number): string {
  return span > 1 ? `${start + 1} / span ${span}` : `${start + 1}`;
}

async function updateGridDimensions(
  rows: number,
  columns: number,
  templateColumns?: string,
): Promise<void> {
  const target = quickStackTarget.value;
  if (!target) return;
  const selectedNodeId = selectedNode.value?.id;
  rows = Math.max(1, Math.min(12, Math.round(rows)));
  columns = Math.max(1, Math.min(12, Math.round(columns)));
  const count = rows * columns;
  const children = target.children ?? [];
  const removedCells = count < children.length ? children.slice(count) : [];
  // Never discard authored content as a side effect of changing the grid size.
  if (removedCells.some((child) => child.children?.length)) return;

  const saved = await propertySave.saveNodeUpdates(
    {
      styles: {
        gridTemplateColumns: {
          base: templateColumns ?? `repeat(${columns}, minmax(0, 1fr))`,
        },
        gridTemplateRows: { base: `repeat(${rows}, minmax(6rem, auto))` },
      },
    },
    props.currentItemType,
    props.currentItemSlug,
    target.id,
  );
  if (!saved) return;

  if (count > children.length) {
    for (let index = children.length; index < count; index++) emit("grid-action", { gridId: target.id, action: "resize", rows, columns });
  } else if (count < children.length) {
    removedCells.forEach((child) => emit("grid-action", { gridId: target.id, cellId: child.id, action: "resize", rows, columns }));
  }

  const updatedTarget = await waitForBuilderNode(target.id, count);
  if (!updatedTarget || updatedTarget.children?.length !== count) {
    await restoreGridToolsSelection(selectedNodeId);
    return;
  }
  for (const cell of updatedTarget.children ?? []) {
    const cellSaved = await propertySave.saveNodeUpdates(
      { styles: { gridColumn: { base: "auto" }, gridRow: { base: "auto" } } },
      props.currentItemType,
      props.currentItemSlug,
      cell.id,
    );
    if (!cellSaved) return;
  }
  await nextTick();
  await restoreGridToolsSelection(selectedNodeId);
}

async function applyGridLayoutPreset(preset: (typeof CANVAS_GRID_LAYOUT_PRESETS)[number]): Promise<void> {
  const target = quickStackTarget.value;
  if (!target) return;
  const selectedNodeId = selectedNode.value?.id;

  const children = target.children ?? [];
  const removedCells = children.slice(preset.cells.length);
  if (removedCells.some((child) => child.children?.length)) return;

  const saved = await propertySave.saveNodeUpdates(
    {
      styles: {
        gridTemplateColumns: {
          base: "templateColumns" in preset
            ? preset.templateColumns
            : `repeat(${preset.columns}, minmax(0, 1fr))`,
        },
        gridTemplateRows: { base: `repeat(${preset.rows}, minmax(6rem, auto))` },
      },
    },
    props.currentItemType,
    props.currentItemSlug,
    target.id,
  );
  if (!saved) return;

  for (let index = children.length; index < preset.cells.length; index++) {
    emit("grid-action", { gridId: target.id, action: "resize", rows: preset.rows, columns: preset.columns });
  }
  removedCells.forEach((cell) => emit("grid-action", { gridId: target.id, cellId: cell.id, action: "resize", rows: preset.rows, columns: preset.columns }));

  const updatedTarget = await waitForBuilderNode(target.id, preset.cells.length);
  if (!updatedTarget || updatedTarget.children?.length !== preset.cells.length) {
    await restoreGridToolsSelection(selectedNodeId);
    return;
  }

  for (const [index, cell] of updatedTarget.children.entries()) {
    const placement = preset.cells[index];
    const cellSaved = await propertySave.saveNodeUpdates(
      {
        styles: {
          gridColumn: { base: placement ? placement.column : "auto" },
          gridRow: { base: placement ? placement.row : "auto" },
        },
      },
      props.currentItemType,
      props.currentItemSlug,
      cell.id,
    );
    if (!cellSaved) return;
  }
  await nextTick();
  await restoreGridToolsSelection(selectedNodeId);
}

async function handleGridEdgeAction(edge: "north" | "east" | "south" | "west", action: "insert" | "merge"): Promise<void> {
  const cell = selectedGridCell.value;
  if (!cell) return;
  if (action === "insert") {
    const insertRow = edge === "north" || edge === "south";
    const rows = cell.rows + (insertRow ? 1 : 0);
    const columns = cell.columns + (insertRow ? 0 : 1);
    if (rows > 12 || columns > 12) return;
    const line = insertRow
      ? edge === "north" ? cell.row : cell.row + cell.rowSpan
      : edge === "west" ? cell.column : cell.column + cell.columnSpan;
    const shifted = cell.children.map((child, index) => {
      const previous = cell.placements[index];
      const start = insertRow ? previous.row : previous.column;
      const span = insertRow ? previous.rowSpan : previous.columnSpan;
      const nextStart = start >= line ? start + 1 : start;
      const nextSpan = start < line && start + span > line ? span + 1 : span;
      return {
        child,
        index,
        row: insertRow ? nextStart : previous.row,
        column: insertRow ? previous.column : nextStart,
        rowSpan: insertRow ? nextSpan : previous.rowSpan,
        columnSpan: insertRow ? previous.columnSpan : nextSpan,
      };
    });
    const occupied = new Set<string>();
    for (const placement of shifted) {
      for (let row = placement.row; row < placement.row + placement.rowSpan; row++) {
        for (let column = placement.column; column < placement.column + placement.columnSpan; column++) occupied.add(`${row}:${column}`);
      }
    }
    const additions: Array<{ row: number; column: number; rowSpan: number; columnSpan: number }> = [];
    if (insertRow) {
      for (let column = 0; column < columns; column++) {
        if (!occupied.has(`${line}:${column}`)) {
          additions.push({ row: line, column, rowSpan: 1, columnSpan: 1 });
        }
      }
    } else {
      for (let row = 0; row < rows; row++) {
        if (!occupied.has(`${row}:${line}`)) {
          additions.push({ row, column: line, rowSpan: 1, columnSpan: 1 });
        }
      }
    }
    const selectedNodeId = selectedNode.value?.id;
    const sortedExisting = [...shifted].sort((a, b) => a.row - b.row || a.column - b.column);
    const sortedAdditions = [...additions].sort((a, b) => a.row - b.row || a.column - b.column);
    const insertionBoundaries = sortedAdditions.map((placement) =>
      sortedExisting.find((existing) =>
        insertRow
          ? existing.row > placement.row
          : existing.row > placement.row
            || (existing.row === placement.row && existing.column > placement.column),
      )?.index ?? cell.children.length,
    );
    const placements = sortedAdditions.map((placement, index) => {
      const insertionBoundary = insertionBoundaries[index];
      const priorInsertionsAtOrBefore = insertionBoundaries
        .slice(0, index)
        .filter((boundary) => boundary <= insertionBoundary).length;
      return { ...placement, insertionIndex: insertionBoundary + priorInsertionsAtOrBefore };
    });
    if (placements.length) {
      emit("grid-action", {
        gridId: cell.grid.id,
        action: "resize",
        rows,
        columns,
        placements,
        gridMutation: {
          rows,
          columns,
          existingPlacements: shifted.map((placement) => ({
            nodeId: placement.child.id,
            row: placement.row,
            column: placement.column,
            rowSpan: placement.rowSpan,
            columnSpan: placement.columnSpan,
          })),
        },
      });
    }
    const updatedGrid = await waitForBuilderNode(cell.grid.id, cell.children.length + additions.length);
    if (!updatedGrid || updatedGrid.children?.length !== cell.children.length + additions.length) return;
    await nextTick();
    await restoreGridToolsSelection(selectedNodeId);
    return;
  }
  if (!hasGridNeighbor(edge)) return;
  const neighborRow = edge === "north" ? cell.row - 1 : edge === "south" ? cell.row + cell.rowSpan : cell.row;
  const neighborColumn = edge === "west" ? cell.column - 1 : edge === "east" ? cell.column + cell.columnSpan : cell.column;
  const neighborIndex = cell.placements.findIndex((placement) => neighborRow >= placement.row && neighborRow < placement.row + placement.rowSpan && neighborColumn >= placement.column && neighborColumn < placement.column + placement.columnSpan);
  const neighbor = cell.children[neighborIndex];
  if (!neighbor || neighbor.children?.length) return;
  const neighborPlacement = cell.placements[neighborIndex];
  if (!neighborPlacement) return;
  emit("grid-action", {
    gridId: cell.grid.id,
    cellId: cell.node.id,
    neighborId: neighbor.id,
    edge,
    action: "merge",
    placement: {
      row: Math.min(cell.row, neighborPlacement.row),
      column: Math.min(cell.column, neighborPlacement.column),
      rowSpan: Math.max(cell.row + cell.rowSpan, neighborPlacement.row + neighborPlacement.rowSpan)
        - Math.min(cell.row, neighborPlacement.row),
      columnSpan: Math.max(cell.column + cell.columnSpan, neighborPlacement.column + neighborPlacement.columnSpan)
        - Math.min(cell.column, neighborPlacement.column),
    },
  });
}

const hideToolbarDuringLibraryDrag = computed(() =>
  shouldHideSelectionToolbar(isDragging.value, dragSource.value),
);

const TEXT_NODE_TYPES = new Set([
  "heading",
  "text",
  "paragraph",
  "span",
  "richtext",
  "rich-text",
]);

const iframeRefProp = toRef(props, "iframeRef");
const overlays = useCanvasOverlays({
  iframeRef: computed(() => iframeRefProp.value ?? null),
  debug: import.meta.env.DEV,
});
watch(() => overlays.selection.nodeId, () => {
  clearGridInsertionGuide();
  quickAddMenuOpen.value = false;
});

const RESIZE_STYLE_PROPERTIES = [
  "width",
  "height",
  "widthSizing",
  "heightSizing",
] as const;
const RESIZE_KEYBOARD_COMMIT_DELAY_MS = 320;

type ResizePreviewSnapshot = ReturnType<
  typeof resizeStyleTarget.captureAuthoredStylePreviewSnapshot
>;

interface ResizeSession {
  kind: "keyboard" | "pointer";
  handle: CanvasSelectionResizeHandle;
  hasChanged: boolean;
  nodeId: string;
  startSize: CanvasSelectionSize;
  currentSize: CanvasSelectionSize;
  snapshot: ResizePreviewSnapshot;
  pointerId?: number;
  startClientX?: number;
  startClientY?: number;
  scaleX?: number;
  scaleY?: number;
  captureTarget?: HTMLButtonElement;
}

const resizePreviewSize = ref<CanvasSelectionSize | null>(null);
const isResizingSelection = ref(false);
const resizeAnnouncement = ref("");
let resizeSession: ResizeSession | null = null;
let resizePreviewFrame: number | null = null;
let pendingResizePreview: {
  size: CanvasSelectionSize;
  handle: CanvasSelectionResizeHandle;
} | null = null;
let keyboardCommitTimeout: number | null = null;

const measuredSelectionSize = computed(() => {
  // Position changes whenever the selected element is remeasured. Reading it
  // here keeps the badge synchronized with ResizeObserver-driven updates.
  void overlays.selection.position;
  return measureCanvasSelectionElement(overlays.selection.element);
});

const displayedSelectionSize = computed(
  () => resizePreviewSize.value ?? measuredSelectionSize.value,
);

const selectionFrameStyle = computed((): CSSProperties => {
  const position = overlays.selection.position;
  if (!overlays.selection.visible || !position) {
    return { display: "none" };
  }

  return {
    display: "block",
    position: "fixed",
    left: "0",
    top: "0",
    translate: `${position.left}px ${position.top}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    zIndex: OVERLAY_Z_INDEX.selection,
  };
});

const selectionSizeLabel = computed(() =>
  displayedSelectionSize.value
    ? formatCanvasSelectionSize(displayedSelectionSize.value)
    : "",
);

const showSelectionSizeBadge = computed(
  () => props.showSelectionSizing && Boolean(selectionSizeLabel.value),
);

watchEffect(() => {
  if (!canvasQuickTools) return;
  const grid = overlays.selection.visible ? quickStackTarget.value : null;
  canvasQuickTools.value = {
    selectionSizeLabel: showSelectionSizeBadge.value
      ? selectionSizeLabel.value
      : "",
    grid: grid
      ? {
          ...quickStackDimensions.value,
          applyDimensions: updateGridDimensions,
        }
      : null,
  };
});

const canResizeSelection = computed(() => {
  const node = selectedNode.value;
  return Boolean(
    overlays.selection.visible &&
    overlays.selection.nodeId &&
    overlays.selection.position &&
    overlays.selection.element &&
    node &&
    node.id === overlays.selection.nodeId &&
    !isMultiSelect.value &&
    !inspectorState.isLocked.value &&
    !inspectorState.isReadonly.value &&
    inspectorState.selectedPseudo.value === "default" &&
    !node.metadata?.locked &&
    props.currentItemType &&
    props.currentItemSlug &&
    !isDragging.value &&
    !resizeStyleTarget.isLoading.value,
  );
});

function getResizeHandleClass(handle: CanvasSelectionResizeHandle): string {
  switch (handle) {
    case "north-west":
      return "left-0 top-0 -translate-x-1/2 -translate-y-1/2";
    case "north":
      return "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2";
    case "north-east":
      return "right-0 top-0 translate-x-1/2 -translate-y-1/2";
    case "east":
      return "right-0 top-1/2 translate-x-1/2 -translate-y-1/2";
    case "south-east":
      return "bottom-0 right-0 translate-x-1/2 translate-y-1/2";
    case "south":
      return "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2";
    case "south-west":
      return "bottom-0 left-0 -translate-x-1/2 translate-y-1/2";
    case "west":
      return "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}

const RESIZE_HANDLE_DIRECTION_KEYS = {
  "north-west": "composer.canvas.resize.northWest",
  north: "composer.canvas.resize.north",
  "north-east": "composer.canvas.resize.northEast",
  east: "composer.canvas.resize.east",
  "south-east": "composer.canvas.resize.southEast",
  south: "composer.canvas.resize.south",
  "south-west": "composer.canvas.resize.southWest",
  west: "composer.canvas.resize.west",
} as const satisfies Record<
  CanvasSelectionResizeHandle,
  Parameters<typeof t>[0]
>;

function getResizeHandleLabel(handle: CanvasSelectionResizeHandle): string {
  return t("composer.canvas.resizeHandle", {
    direction: t(RESIZE_HANDLE_DIRECTION_KEYS[handle]),
  });
}

function isCornerResizeHandle(handle: CanvasSelectionResizeHandle): boolean {
  return handle.includes("-");
}

function getResizeHandleIndicatorClass(
  handle: CanvasSelectionResizeHandle,
): string {
  if (isCornerResizeHandle(handle)) {
    return "size-2 border border-solid border-primary bg-white";
  }

  return handle === "north" || handle === "south"
    ? "h-0.5 w-3 bg-primary"
    : "h-3 w-0.5 bg-primary";
}

function buildResizeStyleUpdates(
  size: CanvasSelectionSize,
  handle: CanvasSelectionResizeHandle,
): Record<string, string> {
  const axes = canvasSelectionResizeAxes(handle);
  const updates: Record<string, string> = {};

  if (axes.width) {
    updates.width = `${Math.max(1, Math.round(size.width))}px`;
    updates.widthSizing = "exact";
  }
  if (axes.height) {
    updates.height = `${Math.max(1, Math.round(size.height))}px`;
    updates.heightSizing = "exact";
  }

  return updates;
}

function flushResizePreview(): void {
  if (resizePreviewFrame !== null) {
    window.cancelAnimationFrame(resizePreviewFrame);
    resizePreviewFrame = null;
  }
  if (!pendingResizePreview) return;

  const { size, handle } = pendingResizePreview;
  pendingResizePreview = null;
  propertySave.previewStyleProperties(
    buildResizeStyleUpdates(size, handle),
    resizeSession?.nodeId,
  );
  overlays.schedulePositionUpdate("measure");
}

function queueResizePreview(
  size: CanvasSelectionSize,
  handle: CanvasSelectionResizeHandle,
): void {
  resizePreviewSize.value = size;
  pendingResizePreview = { size, handle };
  if (resizePreviewFrame !== null) return;

  resizePreviewFrame = window.requestAnimationFrame(() => {
    resizePreviewFrame = null;
    flushResizePreview();
  });
}

function clearKeyboardCommitTimeout(): void {
  if (keyboardCommitTimeout === null) return;
  window.clearTimeout(keyboardCommitTimeout);
  keyboardCommitTimeout = null;
}

function clearResizeInteractionState(): void {
  const activeSession = resizeSession;
  resizeSession = null;
  clearKeyboardCommitTimeout();
  if (resizePreviewFrame !== null) {
    window.cancelAnimationFrame(resizePreviewFrame);
    resizePreviewFrame = null;
  }
  pendingResizePreview = null;
  resizePreviewSize.value = null;
  isResizingSelection.value = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  window.removeEventListener("pointermove", handleResizePointerMove);
  window.removeEventListener("pointerup", handleResizePointerUp);
  window.removeEventListener("pointercancel", handleResizePointerCancel);
  window.removeEventListener("keydown", handleResizeWindowKeydown);

  const captureTarget = activeSession?.captureTarget;
  const pointerId = activeSession?.pointerId;
  if (captureTarget && pointerId !== undefined) {
    captureTarget.removeEventListener(
      "lostpointercapture",
      handleResizeLostPointerCapture,
    );
    if (captureTarget.hasPointerCapture?.(pointerId)) {
      captureTarget.releasePointerCapture(pointerId);
    }
  }
}

function restoreResizeSnapshot(session: ResizeSession): void {
  resizeStyleTarget.restoreAuthoredStylePreviewSnapshot(
    RESIZE_STYLE_PROPERTIES,
    session.snapshot,
  );
  overlays.schedulePositionUpdate("measure");
}

function cancelResizeSession(): void {
  const session = resizeSession;
  if (!session) return;
  flushResizePreview();
  restoreResizeSnapshot(session);
  clearResizeInteractionState();
}

async function commitResizeSession(): Promise<void> {
  const session = resizeSession;
  if (!session) return;
  if (!session.hasChanged) {
    clearResizeInteractionState();
    return;
  }

  flushResizePreview();
  const finalSize = session.currentSize;
  const updates = buildResizeStyleUpdates(finalSize, session.handle);
  clearResizeInteractionState();

  const saved = await resizeStyleTarget.saveStyleProperties(
    updates,
    props.currentItemType,
    props.currentItemSlug,
  );

  if (!saved) {
    restoreResizeSnapshot(session);
    return;
  }

  resizeAnnouncement.value = "";
  await nextTick();
  resizeAnnouncement.value = t("composer.canvas.resizeComplete", {
    size: formatCanvasSelectionSize(finalSize),
  });
  overlays.schedulePositionUpdate("measure");
}

function startResizeSession(
  kind: ResizeSession["kind"],
  handle: CanvasSelectionResizeHandle,
): ResizeSession | null {
  if (!canResizeSelection.value) return null;
  const nodeId = overlays.selection.nodeId;
  const startSize = measureCanvasSelectionElement(overlays.selection.element);
  if (!nodeId || !startSize) return null;

  if (resizeSession) {
    cancelResizeSession();
  }

  const session: ResizeSession = {
    kind,
    handle,
    hasChanged: false,
    nodeId,
    startSize,
    currentSize: startSize,
    snapshot: resizeStyleTarget.captureAuthoredStylePreviewSnapshot(
      RESIZE_STYLE_PROPERTIES,
    ),
  };
  resizeSession = session;
  resizePreviewSize.value = startSize;
  isResizingSelection.value = true;
  return session;
}

function handleResizePointerDown(
  handle: CanvasSelectionResizeHandle,
  event: PointerEvent,
): void {
  if (event.button !== 0) return;
  const session = startResizeSession("pointer", handle);
  if (!session) return;

  event.preventDefault();
  event.stopPropagation();
  const scale = getCanvasSelectionScale(props.iframeRef);
  session.pointerId = event.pointerId;
  session.startClientX = event.clientX;
  session.startClientY = event.clientY;
  session.scaleX = scale.x;
  session.scaleY = scale.y;

  const captureTarget = event.currentTarget;
  if (captureTarget instanceof HTMLButtonElement) {
    session.captureTarget = captureTarget;
    captureTarget.addEventListener(
      "lostpointercapture",
      handleResizeLostPointerCapture,
    );
    captureTarget.setPointerCapture(event.pointerId);
  }

  document.body.style.cursor = canvasSelectionResizeCursor(handle);
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", handleResizePointerMove);
  window.addEventListener("pointerup", handleResizePointerUp);
  window.addEventListener("pointercancel", handleResizePointerCancel);
  window.addEventListener("keydown", handleResizeWindowKeydown);
}

function handleResizeLostPointerCapture(event: PointerEvent): void {
  const session = resizeSession;
  if (
    !session ||
    session.kind !== "pointer" ||
    session.pointerId !== event.pointerId
  ) {
    return;
  }

  cancelResizeSession();
}

function handleResizePointerMove(event: PointerEvent): void {
  const session = resizeSession;
  if (
    !session ||
    session.kind !== "pointer" ||
    session.pointerId !== event.pointerId
  ) {
    return;
  }

  event.preventDefault();
  const nextSize = resizeCanvasSelection({
    handle: session.handle,
    startSize: session.startSize,
    deltaX:
      (event.clientX - (session.startClientX ?? event.clientX)) /
      (session.scaleX ?? 1),
    deltaY:
      (event.clientY - (session.startClientY ?? event.clientY)) /
      (session.scaleY ?? 1),
  });
  const movementX = Math.abs(
    event.clientX - (session.startClientX ?? event.clientX),
  );
  const movementY = Math.abs(
    event.clientY - (session.startClientY ?? event.clientY),
  );
  if (!session.hasChanged && movementX < 2 && movementY < 2) {
    return;
  }
  session.hasChanged = true;
  session.currentSize = nextSize;
  queueResizePreview(nextSize, session.handle);
}

function handleResizePointerUp(event: PointerEvent): void {
  if (
    !resizeSession ||
    resizeSession.kind !== "pointer" ||
    resizeSession.pointerId !== event.pointerId
  ) {
    return;
  }
  event.preventDefault();
  if (!resizeSession.hasChanged) {
    clearResizeInteractionState();
    return;
  }
  void commitResizeSession();
}

function handleResizePointerCancel(event: PointerEvent): void {
  if (
    !resizeSession ||
    resizeSession.kind !== "pointer" ||
    resizeSession.pointerId !== event.pointerId
  ) {
    return;
  }
  cancelResizeSession();
}

function handleResizeWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || resizeSession?.kind !== "pointer") return;
  event.preventDefault();
  cancelResizeSession();
}

function handleResizeHandleKeydown(
  handle: CanvasSelectionResizeHandle,
  event: KeyboardEvent,
): void {
  if (event.key === "Escape" && resizeSession?.kind === "keyboard") {
    event.preventDefault();
    cancelResizeSession();
    return;
  }

  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    return;
  }

  const axes = canvasSelectionResizeAxes(handle);
  const isHorizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  if ((isHorizontal && !axes.width) || (!isHorizontal && !axes.height)) {
    return;
  }

  event.preventDefault();
  let session = resizeSession;
  if (!session || session.kind !== "keyboard" || session.handle !== handle) {
    session = startResizeSession("keyboard", handle);
  }
  if (!session) return;

  const step = event.shiftKey ? 10 : 1;
  const nextSize = {
    width: Math.max(
      1,
      session.currentSize.width +
        (event.key === "ArrowRight"
          ? step
          : event.key === "ArrowLeft"
            ? -step
            : 0),
    ),
    height: Math.max(
      1,
      session.currentSize.height +
        (event.key === "ArrowDown"
          ? step
          : event.key === "ArrowUp"
            ? -step
            : 0),
    ),
  };
  session.hasChanged = true;
  session.currentSize = nextSize;
  queueResizePreview(nextSize, handle);

  clearKeyboardCommitTimeout();
  keyboardCommitTimeout = window.setTimeout(() => {
    keyboardCommitTimeout = null;
    void commitResizeSession();
  }, RESIZE_KEYBOARD_COMMIT_DELAY_MS);
}

function handleResizeHandleBlur(): void {
  if (resizeSession?.kind !== "keyboard") return;
  void commitResizeSession();
}

watch(
  () => overlays.selection.nodeId,
  (nodeId, previousNodeId) => {
    if (previousNodeId && nodeId !== previousNodeId && resizeSession) {
      cancelResizeSession();
    }
  },
);

onBeforeUnmount(() => {
  clearGridInsertionGuide();
  if (resizeSession) {
    cancelResizeSession();
  } else {
    clearResizeInteractionState();
  }
});

const isTextNode = computed(() => {
  const t = overlays.selection.nodeType?.toLowerCase();
  return Boolean(t && TEXT_NODE_TYPES.has(t));
});

const isHeadingNode = computed(() => {
  return overlays.selection.nodeType?.toLowerCase() === "heading";
});

const headingLevel = computed(() => getContentHeadingLevel(selectedNode.value));

const toolbarTextColor = computed(() => {
  if (!isTextNode.value) return "";

  const colorStyle = selectedNode.value?.styles?.color;
  if (colorStyle) {
    const explicit = (colorStyle as Record<string, string>).base ?? "";
    if (explicit) return explicit;
  }

  const el = overlays.selection.element as HTMLElement | null;
  if (el) {
    const view = (el.ownerDocument as Document).defaultView;
    if (view) {
      return view.getComputedStyle(el).color || "";
    }
  }

  return "";
});

const { toolbarContrastBackground, resolvedToolbarContrastBackground } =
  useToolbarTextColorContext({
    selectedNode,
    iframeElement: computed(
      () => overlays.selection.element as HTMLElement | null,
    ),
  });

function handleColorChange(value: string): void {
  const nodeId = overlays.selection.nodeId;
  if (!nodeId) return;
  signalStyleUpdate({
    nodeId,
    styles: { base: { color: value } },
  });
  emit("toolbar-style-change", "color", value, nodeId);
}

function handleHeadingLevelChange(level: number): void {
  const nodeId = overlays.selection.nodeId;
  if (!nodeId || !Number.isInteger(level) || level < 1 || level > 6) return;
  if (headingLevel.value === level) return;

  emit("toolbar-props-change", { level }, nodeId);
}

const TOOLBAR_PADDING = 2;
const TOOLBAR_OFFSET = 12;
const MIN_TOP_SPACE = 60;

const placeToolbarAbove = computed(() => {
  const position = overlays.selection.position;
  if (!position) return false;
  return position.top - TOOLBAR_PADDING - MIN_TOP_SPACE >= 32;
});

const toolbarStyle = computed((): CSSProperties => {
  if (
    !overlays.selection.visible ||
    !overlays.selection.position ||
    hideToolbarDuringLibraryDrag.value ||
    isResizingSelection.value
  ) {
    return { display: "none" };
  }

  const anchor = document.querySelector<HTMLElement>("[data-selection-toolbar-anchor]");
  const anchorRect = anchor?.getBoundingClientRect();
  const bar = anchor?.closest<HTMLElement>("[data-testid='composer-canvas-control-bar']");
  const barRect = bar?.getBoundingClientRect();
  if (anchorRect && barRect) {
    return {
      display: "flex",
      left: `${anchorRect.left + anchorRect.width / 2}px`,
      top: `${barRect.top + barRect.height / 2}px`,
      transform: "translate(-50%, -50%)",
      zIndex: OVERLAY_Z_INDEX.toolbar,
    };
  }

  const { left, top, width, height } = overlays.selection.position;
  const centerX = left + width / 2;
  const clampedCenterX = Math.max(TOOLBAR_PADDING, Math.min(centerX, window.innerWidth - TOOLBAR_PADDING));
  return {
    display: "flex",
    left: `${clampedCenterX}px`,
    top: `${placeToolbarAbove.value ? top - TOOLBAR_OFFSET : top + height + TOOLBAR_OFFSET}px`,
    transform: placeToolbarAbove.value ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    zIndex: OVERLAY_Z_INDEX.toolbar,
  };
});

const gridToolsPanelStyle = computed((): CSSProperties => {
  const position = overlays.selection.position;
  if (!position) return { display: "none" };
  return {
    position: "fixed",
    left: `${position.left + position.width / 2 + gridToolsOffset.value.x}px`,
    top: `${position.top + position.height / 2 + gridToolsOffset.value.y}px`,
    transform: "translate(-50%, -50%)",
    // Keep the interactive grid controls above the legacy stage selection layer.
    zIndex: 1001,
  };
});

onMounted(() => {
  emit("ready");
  window.addEventListener(QUICK_ADD_USAGE_CHANGED_EVENT, refreshQuickAddElements);
});

onBeforeUnmount(() => {
  window.removeEventListener(QUICK_ADD_USAGE_CHANGED_EVENT, refreshQuickAddElements);
});

defineExpose({
  showHover: overlays.showHover,
  hideHover: overlays.hideHover,
  showSelection: overlays.showSelection,
  hideSelection: overlays.hideSelection,
  updateSelectionPosition: overlays.updateSelectionPosition,
  showInsertion: overlays.showInsertion,
  showFrameInsertion: overlays.showFrameInsertion,
  hideInsertion: overlays.hideInsertion,
  showAddElementsDropFeedback: overlays.showAddElementsDropFeedback,
  hideAddElementsDropFeedback: overlays.hideAddElementsDropFeedback,
  showFrameAffordances: overlays.showFrameAffordances,
  hideAffordances: overlays.hideAffordances,
  showDropZones: overlays.showDropZones,
  activateDropZone: overlays.activateDropZone,
  hideDropZones: overlays.hideDropZones,
  schedulePositionUpdate: overlays.schedulePositionUpdate,
  hover: overlays.hover,
  selection: overlays.selection,
});

function handleToolbarAction(action: ToolbarActionName): void {
  const nodeId = overlays.selection.nodeId;
  if (!nodeId) return;

  emit("toolbar-action", action, nodeId);
}

const insertionStyle = computed(() => {
  if (!overlays.insertion.visible || !overlays.insertion.position) {
    return { display: "none" };
  }
  const { left, top, width, height } = overlays.insertion.position;

  const style: CSSProperties = {
    display: "block",
    position: "fixed",
    left: "0",
    top: "0",
    translate: `${left}px ${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    zIndex: OVERLAY_Z_INDEX.insertion,
  };
  return style;
});

const addElementsInsertionStyle = computed((): CSSProperties => {
  const position = overlays.addElementsDrop.placeholder;
  if (!overlays.addElementsDrop.visible || !position) {
    return { display: "none" };
  }

  return {
    display: "block",
    position: "fixed",
    left: "0",
    top: "0",
    translate: `${position.left}px ${position.top}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    zIndex: OVERLAY_Z_INDEX.insertion,
  };
});

const addElementsTargetStyle = computed((): CSSProperties => {
  const position = overlays.addElementsDrop.target;
  if (!overlays.addElementsDrop.visible || !position) {
    return { display: "none" };
  }

  return {
    display: "block",
    position: "fixed",
    left: "0",
    top: "0",
    translate: `${position.left}px ${position.top}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    zIndex: OVERLAY_Z_INDEX.dropZone,
  };
});

function getAffordanceStyle(
  descriptor: CanvasAffordanceDescriptor,
): CSSProperties {
  const layout = resolveCanvasAffordanceVisualLayout(descriptor);
  return {
    position: "fixed",
    left: "0",
    top: "0",
    translate: `${layout.left}px ${layout.top}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    zIndex: OVERLAY_Z_INDEX.dropZone + Math.min(descriptor.depth, 20),
  };
}

function isCollapsedAffordance(
  descriptor: CanvasAffordanceDescriptor,
): boolean {
  return descriptor.presentation === "collapsed-rail";
}

function getAffordanceLabel(descriptor: CanvasAffordanceDescriptor): string {
  switch (descriptor.kind) {
    case "empty-node":
      return `Empty ${descriptor.nodeType}`;
    case "empty-component":
      return `Empty ${descriptor.nodeType} component`;
    case "missing-media":
      return `Missing ${descriptor.nodeType}`;
    default: {
      const exhaustive: never = descriptor;
      return exhaustive;
    }
  }
}

interface ToolbarButton {
  action: ToolbarActionName;
  title: string;
  iconPath: string;
  isDanger?: boolean;
  show: boolean;
}

const toolbarButtons = computed((): ToolbarButton[] => {
  const { isComponent } = overlays.selection;

  const buttons: ToolbarButton[] = [];

  if (isComponent) {
    buttons.push(
      {
        action: "edit-component",
        title: t("composer.toolbar.editComponent"),
        iconPath: TOOLBAR_ICONS["edit-component"],
        show: true,
      },
      {
        action: "detach-component",
        title: t("composer.toolbar.detachInstance"),
        iconPath: TOOLBAR_ICONS["detach-component"],
        show: true,
      },
    );
  } else {
    buttons.push({
      action: "create-component",
      title: t("composer.toolbar.createComponent"),
      iconPath: TOOLBAR_ICONS["create-component"],
      show: true,
    });
  }

  buttons.push(
    {
      action: "duplicate",
      title: t("common.duplicate"),
      iconPath: TOOLBAR_ICONS.duplicate,
      show: true,
    },
    {
      action: "delete",
      title: t("common.delete"),
      iconPath: TOOLBAR_ICONS.delete,
      isDanger: true,
      show: true,
    },
  );

  return buttons.filter((b) => b.show);
});

const showSelectParent = computed(() => overlays.selection.hasParent);

const isImageNode = computed(() => {
  const t = overlays.selection.nodeType?.toLowerCase();
  return t === "image";
});

const showNodeTypeControls = computed(
  () => isTextNode.value || isHeadingNode.value || isImageNode.value,
);

function formatNodeTypeLabel(type: string | null | undefined): string {
  const value = String(type ?? "").trim();
  if (!value) {
    return t("composer.toolbar.element");
  }
  if (value.toLowerCase() === "svg") {
    return "SVG";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const nodeTypeLabel = computed(() => {
  return formatNodeTypeLabel(overlays.selection.nodeType);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-0 overflow-visible"
      :style="{ zIndex: OVERLAY_Z_INDEX.hover }"
      data-aria-canvas-overlay-root="true"
    >
      <div
        v-if="overlays.selection.visible"
        class="pointer-events-none fixed box-border border border-solid border-primary/85"
        :style="selectionFrameStyle"
        data-overlay="selection-frame"
        :data-node-id="overlays.selection.nodeId"
      >
        <template v-if="canResizeSelection">
          <button
            v-for="handle in CANVAS_SELECTION_RESIZE_HANDLES"
            :key="handle"
            type="button"
            class="pointer-events-auto absolute flex size-6 touch-none select-none items-center justify-center border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            :class="getResizeHandleClass(handle)"
            :style="{ cursor: canvasSelectionResizeCursor(handle) }"
            :aria-label="getResizeHandleLabel(handle)"
            :tabindex="handle === 'south-east' ? 0 : -1"
            :data-resize-handle="handle"
            @pointerdown="handleResizePointerDown(handle, $event)"
            @dragstart.prevent
            @keydown="handleResizeHandleKeydown(handle, $event)"
            @blur="handleResizeHandleBlur"
          >
            <span
              class="block"
              :class="getResizeHandleIndicatorClass(handle)"
              aria-hidden="true"
            />
          </button>
        </template>

      </div>

      <section
        v-if="overlays.selection.visible && quickStackTarget"
        ref="gridToolsPanelRef"
        class="pointer-events-auto fixed flex flex-col gap-2 rounded-sm border border-border bg-sidebar px-2.5 py-2 text-xs text-foreground shadow-lg"
        :style="gridToolsPanelStyle"
        aria-label="Grid structure controls"
        data-testid="composer-grid-tools"
      >
        <div
          class="flex cursor-move select-none touch-none items-center justify-between gap-4"
          @pointerdown="startGridToolsDrag"
          @pointermove="moveGridToolsDrag"
          @pointerup="endGridToolsDrag"
          @pointercancel="endGridToolsDrag"
        >
          <span class="font-semibold">Grid structure</span>
          <span class="text-[10px] text-muted-foreground">{{ quickStackDimensions.columns }}×{{ quickStackDimensions.rows }}</span>
        </div>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="preset in CANVAS_GRID_PRESETS"
            :key="'label' in preset ? preset.label : `${preset.rows}x${preset.columns}`"
            type="button"
            class="grid h-7 w-10 place-items-center rounded-sm border border-border/70 hover:border-primary hover:bg-accent"
            :title="'label' in preset ? preset.label : `${preset.columns} columns, ${preset.rows} rows`"
            :aria-label="'label' in preset ? preset.label : `${preset.columns} columns, ${preset.rows} rows`"
            @click.stop="updateGridDimensions(
              preset.rows,
              preset.columns,
              'templateColumns' in preset ? preset.templateColumns : undefined,
            )"
          >
            <span
              class="grid h-4 w-8 gap-px"
              :style="{
                gridTemplateColumns: 'templateColumns' in preset
                  ? preset.templateColumns
                  : `repeat(${preset.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${preset.rows}, minmax(0, 1fr))`,
              }"
              aria-hidden="true"
            >
              <span
                v-for="cell in preset.cells"
                :key="cell"
                class="rounded-[1px] bg-muted-foreground/70"
              />
            </span>
          </button>
        </div>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="preset in CANVAS_GRID_LAYOUT_PRESETS"
            :key="preset.id"
            type="button"
            class="grid h-7 w-10 place-items-center rounded-sm border border-border/70 hover:border-primary hover:bg-accent"
            :title="preset.label"
            :aria-label="preset.label"
            @click.stop="applyGridLayoutPreset(preset)"
          >
            <span
              class="grid h-4 w-8 gap-px"
              :style="{
                gridTemplateColumns: 'templateColumns' in preset
                  ? preset.templateColumns
                  : `repeat(${preset.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${preset.rows}, minmax(0, 1fr))`,
              }"
              aria-hidden="true"
            >
              <span
                v-for="(cell, index) in preset.cells"
                :key="index"
                class="rounded-[1px] bg-muted-foreground/70"
                :style="{ gridColumn: cell.column, gridRow: cell.row }"
              />
            </span>
          </button>
        </div>
        <div class="flex items-center gap-3">
          <div
            v-for="dimension in CANVAS_GRID_DIMENSIONS"
            :key="dimension.key"
            class="flex items-center gap-1"
          >
            <span class="text-muted-foreground">{{ dimension.label }}</span>
            <button
              type="button"
              class="grid size-5 place-items-center rounded hover:bg-accent"
              :aria-label="`Decrease ${dimension.label.toLowerCase()}`"
              @click.stop="updateGridDimensions(
                quickStackDimensions.rows - (dimension.key === 'rows' ? 1 : 0),
                quickStackDimensions.columns - (dimension.key === 'columns' ? 1 : 0),
              )"
            >−</button>
            <span class="w-3 text-center tabular-nums">{{ quickStackDimensions[dimension.key] }}</span>
            <button
              type="button"
              class="grid size-5 place-items-center rounded hover:bg-accent"
              :aria-label="`Increase ${dimension.label.toLowerCase()}`"
              @click.stop="updateGridDimensions(
                quickStackDimensions.rows + (dimension.key === 'rows' ? 1 : 0),
                quickStackDimensions.columns + (dimension.key === 'columns' ? 1 : 0),
              )"
            >+</button>
          </div>
        </div>
      </section>

      <template v-if="selectedEmptyContainer && overlays.selection.position">
        <button
          type="button"
          class="pointer-events-auto grid size-9 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-sm transition hover:border-primary/70 hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :style="emptyContainerCenterStyle"
          aria-label="Add element to this container"
          title="Add element"
          data-testid="empty-container-add-element"
          @click.stop="quickAddMenuOpen = !quickAddMenuOpen"
        >
          <span :class="[studioIcons.addCircle, 'size-5']" aria-hidden="true" />
        </button>

        <section
          v-if="quickAddMenuOpen"
          class="pointer-events-auto fixed max-h-[calc(100vh-24px)] overflow-y-auto rounded-sm border border-border bg-sidebar p-2.5 text-foreground shadow-xl"
          :style="quickAddPanelStyle"
          aria-label="Quick add elements"
          data-testid="empty-container-quick-add"
          @click.stop
        >
          <header class="mb-2 flex items-center justify-between gap-3 px-1">
            <span class="text-xs font-semibold">Add element</span>
            <button
              type="button"
              class="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close quick add"
              @click="quickAddMenuOpen = false; quickAddSearchQuery = ''"
            >
              <span :class="[studioIcons.close, 'size-3.5']" aria-hidden="true" />
            </button>
          </header>
          <label class="mb-2 flex h-8 items-center gap-2 rounded-sm border border-border bg-background/60 px-2.5 focus-within:border-primary">
            <span :class="[studioIcons.search, 'size-3.5 shrink-0 text-muted-foreground']" aria-hidden="true" />
            <input
              v-model="quickAddSearchQuery"
              type="search"
              class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search elements..."
              aria-label="Search elements"
              @keydown.stop
            />
          </label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="element in filteredQuickAddElements"
              :key="element.id"
              type="button"
              class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-sm border border-border/70 bg-background/40 px-1 py-1.5 text-center transition hover:border-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="element.label"
              :title="element.label"
              :data-quick-add-element="element.id"
              @click="addElementToSelectedContainer(element)"
            >
              <span :class="[element.icon, 'size-4 shrink-0 text-muted-foreground']" aria-hidden="true" />
              <span class="max-w-full truncate text-[10px] leading-3">{{ element.label }}</span>
            </button>
          </div>
          <p
            v-if="filteredQuickAddElements.length === 0"
            class="px-2 py-4 text-center text-xs text-muted-foreground"
          >
            No elements found.
          </p>
          <button
            type="button"
            class="mt-2.5 h-8 w-full rounded-sm border border-border bg-background/70 text-xs font-medium text-foreground transition hover:border-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            data-testid="quick-add-view-all"
            @click.stop="openAllElements"
          >
            View all
          </button>
        </section>
      </template>

      <div
        v-if="selectedGridCell"
        class="pointer-events-none fixed inset-0 overflow-visible"
        :style="{ zIndex: OVERLAY_Z_INDEX.markupPreview + 2 }"
        data-overlay="grid-edge-controls"
      >
        <div
          v-for="edge in GRID_EDGES"
          :key="edge"
          class="group pointer-events-auto absolute z-[1000] size-8"
          data-grid-edge-control
          :style="gridEdgeControlStyle(edge)"
          @mouseenter="activateGridInsertionGuide(edge)"
          @mouseleave="clearGridInsertionGuide"
        >
          <span class="absolute left-1/2 top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" aria-hidden="true">
            <span class="size-1.5 rounded-full bg-primary shadow" />
          </span>
          <button type="button" class="pointer-events-none invisible absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100" :style="{ clipPath: edge === 'east' ? 'inset(0 6px 0 0)' : edge === 'west' ? 'inset(0 0 0 6px)' : edge === 'south' ? 'inset(0 0 6px 0)' : 'inset(6px 0 0 0)' }" :title="`Add ${edge === 'north' ? 'row above' : edge === 'south' ? 'row below' : edge === 'west' ? 'column left' : 'column right'}`" :aria-label="`Add ${edge === 'north' ? 'row above' : edge === 'south' ? 'row below' : edge === 'west' ? 'column left' : 'column right'}`" @click.stop="handleGridEdgeAction(edge, 'insert')">
            <span class="grid size-5 place-items-center rounded-[1px] bg-primary text-primary-foreground shadow" aria-hidden="true">
              <span :class="[studioIcons.add, 'size-4']" />
            </span>
          </button>
          <div v-if="hasGridNeighbor(edge)" class="absolute hidden group-hover:block" :class="edge === 'east' ? 'left-4 top-1/2 -translate-y-1/2' : edge === 'west' ? '-left-8 top-1/2 -translate-y-1/2' : edge === 'south' ? 'left-1/2 top-4 -translate-x-1/2' : 'left-1/2 -top-8 -translate-x-1/2'">
            <button type="button" class="group/merge grid size-12 place-items-center rounded-none" :style="{ clipPath: edge === 'east' ? 'inset(0 0 0 10px)' : edge === 'west' ? 'inset(0 10px 0 0)' : edge === 'south' ? 'inset(10px 0 0 0)' : 'inset(0 0 10px 0)' }" :title="`Merge with cell ${edge === 'north' ? 'above' : edge === 'south' ? 'below' : edge === 'west' ? 'on the left' : 'on the right'}`" :aria-label="`Merge with cell ${edge === 'north' ? 'above' : edge === 'south' ? 'below' : edge === 'west' ? 'on the left' : 'on the right'}`" @mouseenter="hoveredGridMergeEdge = edge" @mouseleave="hoveredGridMergeEdge = null" @click.stop="handleGridEdgeAction(edge, 'merge')">
              <span class="grid size-5 place-items-center rounded-[1px] bg-primary text-primary-foreground shadow group-hover/merge:bg-primary/90" aria-hidden="true">
                <span :class="[studioIcons.link, 'size-4']" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="hoveredGridMergeEdge && selectedGridCell"
        class="pointer-events-none fixed rounded-sm bg-primary/20 ring-1 ring-inset ring-primary/60 transition-colors"
        :style="gridMergePreviewStyle"
        aria-hidden="true"
        data-overlay="grid-merge-preview"
      />

      <div
        v-if="hoveredGridEdge && selectedGridCell"
        class="pointer-events-none fixed rounded-full bg-primary/50 shadow-[0_0_0_1px_white]"
        :style="gridInsertionGuideStyle"
        aria-hidden="true"
      />

      <span class="sr-only" role="status" aria-live="polite">
        {{ resizeAnnouncement }}
      </span>

      <div
        v-if="overlays.selection.visible && props.showSelectionToolbar"
        class="selection-toolbar fixed pointer-events-auto flex h-8.5 max-w-[calc(100vw-16px)] select-none items-center whitespace-nowrap rounded-sm border-solid border-border bg-sidebar px-0 pb-0.3 text-xs text-foreground"
        :style="toolbarStyle"
        data-overlay="toolbar"
        :data-node-id="overlays.selection.nodeId"
      >
        <div class="flex min-w-0 items-center gap-1 px-1">
          <Button
            v-if="showSelectParent"
            variant="ghost"
            size="icon-sm"
            class="shrink-0 h-6!"
            data-action="select-parent"
            :title="t('composer.toolbar.selectParent')"
            @click.stop.prevent="handleToolbarAction('select-parent')"
          >
            <span
              :class="[TOOLBAR_ICONS['select-parent'], 'size-3.5 shrink-0']"
            />
          </Button>
          <span
            class="max-w-28 truncate px-1 text-xs font-medium text-muted-foreground capitalize"
          >
            {{ nodeTypeLabel }}
          </span>
        </div>

        <template v-if="showNodeTypeControls">
          <div
            class="mx-1.5 h-2.5 shrink-0 border-l border-solid border-muted-foreground/30"
            aria-hidden="true"
          />

          <div class="flex items-center gap-0 px-0" @click.stop>
            <ColorField
              v-if="isTextNode"
              :model-value="toolbarTextColor"
              variant="toolbar"
              layout="unified"
              show-design-colors
              show-alpha
              content-side="bottom"
              content-align="start"
              :contrast-against="toolbarContrastBackground"
              :resolved-contrast-against="resolvedToolbarContrastBackground"
              @update:model-value="handleColorChange"
            />

            <ToolbarHeadingLevelPicker
              v-if="isHeadingNode"
              :model-value="headingLevel"
              @select="handleHeadingLevelChange"
            />

            <Button
              v-if="isImageNode"
              type="button"
              variant="ghost"
              size="icon-sm"
              class="shrink-0 h-6! w-6!"
              :title="t('inspector.media.chooseImage')"
              @click.stop.prevent="handleToolbarAction('open-media-picker')"
            >
              <span
                :class="[
                  TOOLBAR_ICONS['open-media-picker'],
                  'size-3.5 shrink-0',
                ]"
              />
            </Button>
          </div>
        </template>

        <SelectionToolbarCmsControls />
        <SelectionToolbarMotionControl />

        <div
          class="mx-1.5 h-2.5 shrink-0 border-l border-solid border-muted-foreground/30"
          aria-hidden="true"
        />

        <div class="flex items-center gap-0 pr-1">
          <Button
            v-for="btn in toolbarButtons"
            :key="btn.action"
            variant="ghost"
            size="icon-sm"
            class="shrink-0 h-6! w-6!"
            :class="[
              btn.isDanger
                ? 'hover:border-destructive/50 hover:text-destructive'
                : '',
            ]"
            :data-action="btn.action"
            :title="btn.title"
            @click.stop.prevent="handleToolbarAction(btn.action)"
          >
            <span :class="[btn.iconPath, 'size-3.5 shrink-0']" />
          </Button>
        </div>

        <template v-if="quickSelectionSize">
          <div
            class="mx-1.5 h-2.5 shrink-0 border-l border-solid border-muted-foreground/30"
            aria-hidden="true"
          />
          <span
            class="mr-1.5 whitespace-nowrap px-1.5 font-mono text-[10px] font-medium leading-4 tabular-nums text-muted-foreground"
            aria-label="Selected element dimensions"
            data-testid="composer-selection-size"
          >{{ quickSelectionSize }}</span>
        </template>
      </div>

      <div
        class="pointer-events-none fixed bg-primary will-change-transform"
        :style="insertionStyle"
        data-overlay="insertion"
      />

      <div
        class="pointer-events-none fixed rounded-sm border-2 border-dashed border-primary/70 bg-transparent will-change-transform"
        :style="addElementsTargetStyle"
        data-overlay="add-elements-target"
      />

      <div
        class="pointer-events-none fixed rounded-sm bg-primary shadow-[0_0_4px_color-mix(in_srgb,var(--primary)_35%,transparent)] will-change-transform"
        :style="addElementsInsertionStyle"
        data-overlay="add-elements-insertion"
      />

      <button
        v-for="affordance in visibleAffordances"
        :key="`${affordance.kind}:${affordance.nodeId}`"
        type="button"
        class="pointer-events-auto fixed flex min-h-6 min-w-6 items-center justify-center overflow-visible p-0 text-[10px] font-medium text-primary"
        :class="
          isCollapsedAffordance(affordance)
            ? 'bg-transparent'
            : 'overflow-hidden rounded-sm border border-dashed border-primary/70 bg-primary/10 p-1'
        "
        :style="getAffordanceStyle(affordance)"
        :aria-label="getAffordanceLabel(affordance)"
        :data-overlay="affordance.kind"
        :data-node-id="affordance.nodeId"
        :data-presentation="affordance.presentation"
        @pointerdown.stop.prevent="emit('select-affordance', affordance)"
      >
        <span
          v-if="isCollapsedAffordance(affordance)"
          class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-primary/70"
          aria-hidden="true"
        />
        <span
          class="rounded-sm px-2 py-0.5"
          :class="
            isCollapsedAffordance(affordance)
              ? 'pointer-events-auto absolute right-1 top-1/2 -translate-y-1/2 bg-background'
              : affordance.kind === 'empty-node'
                ? 'pointer-events-none relative border border-primary/25 bg-primary/10 text-primary'
                : 'pointer-events-none relative bg-background'
          "
          aria-hidden="true"
        >
          {{ getAffordanceLabel(affordance) }}
        </span>
      </button>

      <template v-if="overlays.dropZones.visible">
        <div
          v-for="zone in overlays.dropZones.zones"
          :key="zone.id"
          class="pointer-events-none fixed border-2 border-dashed border-primary bg-background transition-all duration-150"
          :class="{
            'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--primary)_15%,transparent)]':
              zone.isActive,
          }"
          :style="{
            position: 'fixed',
            zIndex: OVERLAY_Z_INDEX.dropZone,
            left: `${zone.position.left}px`,
            top: `${zone.position.top}px`,
            width: `${zone.position.width}px`,
            height: `${zone.position.height}px`,
          }"
          data-overlay="drop-zone"
          :data-zone-id="zone.id"
        />
      </template>
    </div>
  </Teleport>
</template>
