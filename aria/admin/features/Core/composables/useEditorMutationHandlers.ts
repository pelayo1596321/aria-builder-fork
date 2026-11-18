import { type Ref } from "vue";
import { toast } from "vue-sonner";
import { z } from "zod";
import type { BuilderNode } from "../../../../lib/types/nodes";
import { BuilderNodeSchema } from "../../../../lib/schemas/nodes";
import { JsonValueSchema } from "../../../../lib/schemas/json";
import type { GridCellMergePayload, ReorderOperation, ReorderNodePayload } from "../../../types/app";
import type { LayersReorderData } from "../../../types/app";
import type { useHistory } from "../../History";
import { cloneDeep } from "../utils";
import type { useNodeManipulation } from "../../Nodes/mutations/useNodeManipulation";
import { log } from "@/lib/utils/logger";
import { useEditorMutationHistory } from "./useEditorMutationHistory";

export interface EditorMutationHandlersDeps {
  pageBlocks: Ref<BuilderNode[]>;
  hasUnsavedChanges: Ref<boolean>;
  history: ReturnType<typeof useHistory>;
  nodeManipulation: ReturnType<typeof useNodeManipulation>;
  nodeEventHandlers: {
    handleLayersReorderNode: (payload: {
      nodeId: string;
      targetNodeId: string;
      position: LayersReorderData["position"];
    }) => void;
  };
  focusNode: (id: string | null) => void;
}

export interface EditorMutationHandlersReturn {
  handleAddBlock: (newBlock: BuilderNode, parentId: string | null, insertionIndex?: number) => void;
  handleAddBlocks: (
    newBlocks: BuilderNode[],
    parentId: string | null,
    insertionIndices: number[],
    gridMutation?: {
      rows: number;
      columns: number;
      existingPlacements: Array<{
        nodeId: string;
        row: number;
        column: number;
        rowSpan: number;
        columnSpan: number;
      }>;
    },
  ) => void;
  handleMergeGridCells: (payload: GridCellMergePayload) => void;
  handleReorderBlock: (operation: ReorderOperation) => void;
  handleReorderNode: (payload: ReorderNodePayload) => void;
  handleNodePropUpdate: (
    nodeId: string,
    propName: string,
    value: unknown,
    description?: string,
  ) => void;
}

const ReorderOperationSchema = z.object({
  sourceParentId: z.string().nullable(),
  sourceIndex: z.int().min(0),
  targetParentId: z.string().nullable(),
  targetIndex: z.int().min(0),
});

const AddBlockInputSchema = z
  .object({
    newBlock: BuilderNodeSchema,
    parentId: z.string().trim().min(1).nullable(),
    insertionIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

const AddBlocksInputSchema = z
  .object({
    newBlocks: z.array(BuilderNodeSchema).min(1),
    parentId: z.string().trim().min(1).nullable(),
    insertionIndices: z.array(z.number().int().nonnegative()),
    gridMutation: z.object({
      rows: z.number().int().min(1),
      columns: z.number().int().min(1),
      existingPlacements: z.array(z.object({
        nodeId: z.string().trim().min(1),
        row: z.number().int().nonnegative(),
        column: z.number().int().nonnegative(),
        rowSpan: z.number().int().min(1),
        columnSpan: z.number().int().min(1),
      }).strict()),
    }).strict().optional(),
  })
  .strict()
  .refine((input) => input.newBlocks.length === input.insertionIndices.length);

const NodePropUpdateInputSchema = z
  .object({
    nodeId: z.string().trim().min(1),
    propName: z.string().trim().min(1),
    value: JsonValueSchema.optional(),
    description: z.string().trim().min(1).optional(),
  })
  .strict();

const GridCellMergeInputSchema = z.object({
  gridId: z.string().trim().min(1),
  cellId: z.string().trim().min(1),
  neighborId: z.string().trim().min(1),
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  rowSpan: z.number().int().min(1),
  columnSpan: z.number().int().min(1),
}).strict();

function findParentArray(
  nodes: BuilderNode[],
  parentId: string | null,
): BuilderNode[] | null {
  if (parentId === null) {
    return nodes;
  }

  const stack: BuilderNode[] = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    if (node.id === parentId) {
      if (!node.children) {
        node.children = [];
      }
      return node.children;
    }

    if (node.children?.length) {
      stack.push(...node.children);
    }
  }

  return null;
}

function applyReorderOperation(
  blocks: BuilderNode[],
  operation: ReorderOperation,
): boolean {
  const sourceArray = findParentArray(blocks, operation.sourceParentId);
  const targetArray = findParentArray(blocks, operation.targetParentId);

  if (!sourceArray || !targetArray) {
    return false;
  }

  if (operation.sourceIndex >= sourceArray.length) {
    return false;
  }

  const [movedNode] = sourceArray.splice(operation.sourceIndex, 1);
  if (!movedNode) {
    return false;
  }

  let adjustedTargetIndex = operation.targetIndex;
  if (
    sourceArray === targetArray &&
    operation.sourceIndex < operation.targetIndex
  ) {
    adjustedTargetIndex = operation.targetIndex - 1;
  }

  const clampedTargetIndex = Math.max(
    0,
    Math.min(adjustedTargetIndex, targetArray.length),
  );

  targetArray.splice(clampedTargetIndex, 0, movedNode);
  return true;
}

export function useEditorMutationHandlers(
  deps: EditorMutationHandlersDeps,
): EditorMutationHandlersReturn {
  const {
    pageBlocks,
    hasUnsavedChanges,
    history,
    nodeManipulation,
    nodeEventHandlers,
    focusNode,
  } = deps;
  const { executeEditorMutation } = useEditorMutationHistory(history);

  const handleAddBlock = (
    newBlock: BuilderNode,
    parentId: string | null,
    requestedInsertionIndex?: number,
  ): void => {
    const parsedInput = AddBlockInputSchema.safeParse({
      newBlock,
      parentId,
      insertionIndex: requestedInsertionIndex,
    });
    if (!parsedInput.success) {
      log("warn", "[EditorMutation] Invalid add-block payload", {
        issues: parsedInput.error.issues,
      });
      toast.error("Could not insert block");
      return;
    }

    const validatedBlock = parsedInput.data.newBlock;
    const validatedParentId = parsedInput.data.parentId;
    const requestedIndex = parsedInput.data.insertionIndex;

    if (!validatedParentId) {
      const insertIndex = Math.min(requestedIndex ?? pageBlocks.value.length, pageBlocks.value.length);

      const executed = executeEditorMutation(
        {
          type: "insert-node",
          description: `Add ${validatedBlock.type} block`,
          affectedNodeIds: [validatedBlock.id],
        },
        {
          undo: () => {
            pageBlocks.value.splice(insertIndex, 1);
            focusNode(null);
          },
          redo: () => {
            pageBlocks.value.splice(insertIndex, 0, validatedBlock);
            focusNode(validatedBlock.id);
          },
        },
      );

      if (!executed) {
        toast.error("Could not insert block");
        return;
      }

      hasUnsavedChanges.value = true;
      toast.success(`Added ${validatedBlock.type} block`);
      return;
    }

    const parent = nodeManipulation.findNodeById(
      pageBlocks.value,
      validatedParentId,
    );
    if (!parent) {
      toast.error("Could not insert block: parent not found");
      return;
    }

    if (!parent.children) {
      parent.children = [];
    }

    const insertIndex = Math.min(requestedIndex ?? parent.children.length, parent.children.length);

    const executed = executeEditorMutation(
      {
        type: "insert-node",
        description: `Add ${validatedBlock.type} block`,
        affectedNodeIds: [validatedBlock.id],
      },
      {
        undo: () => {
          parent.children?.splice(insertIndex, 1);
          focusNode(null);
        },
        redo: () => {
          if (!parent.children) parent.children = [];
          parent.children.splice(insertIndex, 0, validatedBlock);
          focusNode(validatedBlock.id);
        },
      },
    );

    if (!executed) {
      toast.error("Could not insert block");
      return;
    }

    hasUnsavedChanges.value = true;
    toast.success(`Added ${validatedBlock.type} block`);
  };

  const handleAddBlocks = (
    newBlocks: BuilderNode[],
    parentId: string | null,
    insertionIndices: number[],
    gridMutation?: {
      rows: number;
      columns: number;
      existingPlacements: Array<{
        nodeId: string;
        row: number;
        column: number;
        rowSpan: number;
        columnSpan: number;
      }>;
    },
  ): void => {
    const parsedInput = AddBlocksInputSchema.safeParse({
      newBlocks,
      parentId,
      insertionIndices,
      gridMutation,
    });
    if (!parsedInput.success) {
      log("warn", "[EditorMutation] Invalid add-blocks payload", {
        issues: parsedInput.error.issues,
      });
      toast.error("Could not insert grid cells");
      return;
    }

    const validatedBlocks = parsedInput.data.newBlocks;
    const validatedParentId = parsedInput.data.parentId;
    const parent = validatedParentId
      ? nodeManipulation.findNodeById(pageBlocks.value, validatedParentId)
      : null;
    if (validatedParentId && !parent) {
      toast.error("Could not insert grid cells: parent not found");
      return;
    }

    if (parent && !parent.children) parent.children = [];
    const destination = parent?.children ?? pageBlocks.value;
    const gridNode = parsedInput.data.gridMutation && validatedParentId
      ? nodeManipulation.findNodeById(pageBlocks.value, validatedParentId)
      : null;
    if (parsedInput.data.gridMutation && (!gridNode || gridNode !== parent)) {
      toast.error("Could not update grid structure");
      return;
    }

    const previousChildren = [...destination];
    const nextChildren = [...previousChildren];
    validatedBlocks.forEach((block, index) => {
      const insertionIndex = Math.min(
        parsedInput.data.insertionIndices[index],
        nextChildren.length,
      );
      nextChildren.splice(insertionIndex, 0, block);
    });

    const gridUpdate = parsedInput.data.gridMutation;
    const previousGridStyles = gridNode ? cloneDeep(gridNode.styles) : null;
    const previousCellStyles = new Map(
      (gridNode?.children ?? []).map((child) => [child.id, cloneDeep(child.styles)]),
    );
    const nextGridStyles = gridNode && gridUpdate
      ? {
          ...cloneDeep(gridNode.styles),
          gridTemplateColumns: {
            ...(gridNode.styles.gridTemplateColumns ?? {}),
            base: `repeat(${gridUpdate.columns}, minmax(0, 1fr))`,
          },
          gridTemplateRows: {
            ...(gridNode.styles.gridTemplateRows ?? {}),
            base: `repeat(${gridUpdate.rows}, minmax(6rem, auto))`,
          },
        }
      : null;
    const nextCellStyles = new Map<string, BuilderNode["styles"]>();
    if (gridNode && gridUpdate) {
      for (const placement of gridUpdate.existingPlacements) {
        const child = gridNode.children?.find((entry) => entry.id === placement.nodeId);
        if (!child) continue;
        nextCellStyles.set(child.id, {
          ...cloneDeep(child.styles),
          gridColumn: {
            ...(child.styles.gridColumn ?? {}),
            base: placement.columnSpan > 1
              ? `${placement.column + 1} / span ${placement.columnSpan}`
              : String(placement.column + 1),
          },
          gridRow: {
            ...(child.styles.gridRow ?? {}),
            base: placement.rowSpan > 1
              ? `${placement.row + 1} / span ${placement.rowSpan}`
              : String(placement.row + 1),
          },
        });
      }
    }

    const applyState = (
      children: BuilderNode[],
      gridStyles: BuilderNode["styles"] | null,
      cellStyles: Map<string, BuilderNode["styles"]>,
    ): void => {
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.splice(0, parent.children.length, ...children);
      } else {
        pageBlocks.value.splice(0, pageBlocks.value.length, ...children);
      }
      if (gridNode && gridStyles) gridNode.styles = cloneDeep(gridStyles);
      if (gridNode) {
        for (const child of gridNode.children ?? []) {
          const styles = cellStyles.get(child.id);
          if (styles) child.styles = cloneDeep(styles);
        }
      }
    };

    const executed = executeEditorMutation(
      {
        type: "insert-node",
        description: gridUpdate ? "Insert grid row or column" : "Add blocks",
        affectedNodeIds: [
          ...(gridNode ? [gridNode.id] : []),
          ...validatedBlocks.map((block) => block.id),
          ...(gridUpdate?.existingPlacements.map((placement) => placement.nodeId) ?? []),
        ],
      },
      {
        undo: () => {
          applyState(previousChildren, previousGridStyles, previousCellStyles);
          focusNode(null);
        },
        redo: () => {
          applyState(nextChildren, nextGridStyles, nextCellStyles);
          focusNode(validatedBlocks.at(-1)?.id ?? null);
        },
      },
    );

    if (!executed) {
      toast.error("Could not insert grid cells");
      return;
    }

    hasUnsavedChanges.value = true;
    toast.success(`Added ${validatedBlocks.length} grid cells`);
  };

  const handleMergeGridCells = (payload: GridCellMergePayload): void => {
    const parsed = GridCellMergeInputSchema.safeParse(payload);
    if (!parsed.success) {
      log("warn", "[EditorMutation] Invalid grid-cell merge payload", {
        issues: parsed.error.issues,
      });
      toast.error("Could not merge grid cells");
      return;
    }

    const { gridId, cellId, neighborId, row, column, rowSpan, columnSpan } = parsed.data;
    const beforeBlocks = cloneDeep(pageBlocks.value);
    const nextBlocks = cloneDeep(pageBlocks.value);
    const grid = nodeManipulation.findNodeById(nextBlocks, gridId);
    if (!grid || !Array.isArray(grid.children)) {
      toast.error("Could not merge grid cells: grid not found");
      return;
    }

    const cell = grid.children.find((child) => child.id === cellId);
    const neighborIndex = grid.children.findIndex((child) => child.id === neighborId);
    const neighbor = grid.children[neighborIndex];
    if (!cell || !neighbor || neighbor.children?.length) {
      toast.error("Could not merge grid cells");
      return;
    }

    const nextGridRow = rowSpan > 1 ? `${row + 1} / span ${rowSpan}` : String(row + 1);
    const nextGridColumn = columnSpan > 1
      ? `${column + 1} / span ${columnSpan}`
      : String(column + 1);
    cell.styles = {
      ...cloneDeep(cell.styles),
      gridRow: {
        ...(cell.styles.gridRow ?? {}),
        base: nextGridRow,
      },
      gridColumn: {
        ...(cell.styles.gridColumn ?? {}),
        base: nextGridColumn,
      },
    };
    grid.children.splice(neighborIndex, 1);

    const executed = executeEditorMutation(
      {
        type: "update-node-styles",
        description: "Merge adjacent grid cells",
        affectedNodeIds: [gridId, cellId, neighborId],
      },
      {
        undo: () => {
          pageBlocks.value = cloneDeep(beforeBlocks);
          focusNode(null);
        },
        redo: () => {
          pageBlocks.value = cloneDeep(nextBlocks);
          focusNode(cellId);
        },
      },
    );

    if (!executed) {
      toast.error("Could not merge grid cells");
      return;
    }

    hasUnsavedChanges.value = true;
    focusNode(cellId);
    toast.success("Merged grid cells");
  };

  const handleReorderBlock = (operation: ReorderOperation): void => {
    const validation = ReorderOperationSchema.safeParse(operation);
    if (!validation.success) {
      toast.error("Invalid reorder payload");
      return;
    }

    const validatedOperation = validation.data;
    const beforeBlocks = cloneDeep(pageBlocks.value);
    const nextBlocks = cloneDeep(pageBlocks.value);

    const didReorder = applyReorderOperation(nextBlocks, validatedOperation);
    if (!didReorder) {
      toast.error("Unable to reorder block");
      return;
    }

    const executed = executeEditorMutation(
      {
        type: "reorder-nodes",
        description: "Reorder canvas block",
        group: {
          key: `stage-reorder:${validatedOperation.sourceParentId ?? "root"}->${validatedOperation.targetParentId ?? "root"}`,
          windowMs: 900,
        },
      },
      {
        undo: () => {
          pageBlocks.value = cloneDeep(beforeBlocks);
        },
        redo: () => {
          pageBlocks.value = cloneDeep(nextBlocks);
        },
      },
    );

    if (!executed) {
      toast.error("Unable to reorder block");
      return;
    }

    hasUnsavedChanges.value = true;
  };

  const handleReorderNode = (payload: ReorderNodePayload): void => {
    if (!payload.targetNodeId) {
      return;
    }

    const nextPosition: LayersReorderData["position"] =
      payload.position === 0 ? "before" : "after";

    nodeEventHandlers.handleLayersReorderNode({
      nodeId: payload.nodeId,
      targetNodeId: payload.targetNodeId,
      position: nextPosition,
    });
  };

  const handleNodePropUpdate = (
    nodeId: string,
    propName: string,
    value: unknown,
    description?: string,
  ): void => {
    const parsedInput = NodePropUpdateInputSchema.safeParse({
      nodeId,
      propName,
      value,
      description,
    });
    if (!parsedInput.success) {
      log("warn", "[EditorMutation] Invalid node-prop update payload", {
        issues: parsedInput.error.issues,
      });
      return;
    }

    const result = nodeManipulation.findNodeToDelete(
      pageBlocks.value,
      parsedInput.data.nodeId,
    );
    if (!result) return;

    const { node } = result;
    const oldValue = node.props?.[parsedInput.data.propName];
    const nextValue = parsedInput.data.value;

    const executed = executeEditorMutation(
      {
        type: "update-node-props",
        description:
          parsedInput.data.description || `Update ${parsedInput.data.propName}`,
        affectedNodeIds: [parsedInput.data.nodeId],
      },
      {
        undo: () => {
          if (!node.props) node.props = {};
          node.props[parsedInput.data.propName] = oldValue;
        },
        redo: () => {
          if (!node.props) node.props = {};
          node.props[parsedInput.data.propName] = nextValue;
        },
      },
    );

    if (!executed) {
      return;
    }

    hasUnsavedChanges.value = true;
  };

  return {
    handleAddBlock,
    handleAddBlocks,
    handleMergeGridCells,
    handleReorderBlock,
    handleReorderNode,
    handleNodePropUpdate,
  };
}
