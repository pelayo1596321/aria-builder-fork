import { z } from "zod";
import type { BuilderNode } from "../../../../lib/types/nodes";
import { BuilderNodeSchema } from "../../../../lib/schemas/nodes";
import type { ReorderOperation } from "../../../types/app";
import { log } from "@/lib/utils/logger";

const StageParentIdSchema = z.string().trim().min(1).nullable();
export interface StageGridMutation {
  rows: number;
  columns: number;
  existingPlacements: Array<{
    nodeId: string;
    row: number;
    column: number;
    rowSpan: number;
    columnSpan: number;
  }>;
}
const StageGridMutationSchema = z.object({
  rows: z.int().min(1),
  columns: z.int().min(1),
  existingPlacements: z.array(z.object({
    nodeId: z.string().trim().min(1),
    row: z.int().nonnegative(),
    column: z.int().nonnegative(),
    rowSpan: z.int().min(1),
    columnSpan: z.int().min(1),
  })),
}).strict();
const StageReorderOperationSchema = z.object({
  sourceParentId: StageParentIdSchema,
  sourceIndex: z.int().min(0),
  targetParentId: StageParentIdSchema,
  targetIndex: z.int().min(0),
});

export interface UseStageMutationActionsDeps {
  handleAddBlock: (block: BuilderNode, parentId: string | null, insertionIndex?: number) => void;
  handleAddBlocks: (blocks: BuilderNode[], parentId: string | null, insertionIndices: number[], gridMutation?: StageGridMutation) => void;
  handleReorderBlock: (operation: ReorderOperation) => void;
}

export interface UseStageMutationActionsReturn {
  handleStageAddBlock: (block: BuilderNode, parentId: string | null) => void;
  handleStageAddBlocks: (blocks: BuilderNode[], parentId: string | null, insertionIndices: number[], gridMutation?: StageGridMutation) => void;
  handleStageReorderBlock: (operation: ReorderOperation) => void;
}

export function useStageMutationActions(
  deps: UseStageMutationActionsDeps,
): UseStageMutationActionsReturn {
  const { handleAddBlock, handleAddBlocks, handleReorderBlock } = deps;

  const handleStageAddBlock = (
    block: BuilderNode,
    parentId: string | null,
    insertionIndex?: number,
  ): void => {
    const parsedBlock = BuilderNodeSchema.safeParse(block);
    const parsedParentId = StageParentIdSchema.safeParse(parentId);
    if (!parsedBlock.success || !parsedParentId.success) {
      log(
        "warn",
        "[useStageMutationActions] Ignoring invalid add-block request",
        {
          blockId: block?.id,
          parentId,
        },
      );
      return;
    }

    handleAddBlock(parsedBlock.data, parsedParentId.data, insertionIndex);
  };

  const handleStageReorderBlock = (operation: ReorderOperation): void => {
    const parsedOperation = StageReorderOperationSchema.safeParse(operation);
    if (!parsedOperation.success) {
      log(
        "warn",
        "[useStageMutationActions] Ignoring invalid reorder operation",
        {
          issues: parsedOperation.error.issues,
        },
      );
      return;
    }

    handleReorderBlock(parsedOperation.data);
  };

  const handleStageAddBlocks = (
    blocks: BuilderNode[],
    parentId: string | null,
    insertionIndices: number[],
    gridMutation?: StageGridMutation,
  ): void => {
    const parsedBlocks = z.array(BuilderNodeSchema).min(1).safeParse(blocks);
    const parsedParentId = StageParentIdSchema.safeParse(parentId);
    const parsedIndices = z.array(z.int().nonnegative()).safeParse(insertionIndices);
    const parsedGridMutation = gridMutation === undefined
      ? { success: true as const, data: undefined }
      : StageGridMutationSchema.safeParse(gridMutation);
    if (
      !parsedBlocks.success
      || !parsedParentId.success
      || !parsedIndices.success
      || !parsedGridMutation.success
      || parsedBlocks.data.length !== parsedIndices.data.length
    ) {
      log("warn", "[useStageMutationActions] Ignoring invalid add-blocks request", {
        parentId,
        blockCount: blocks?.length,
        insertionIndices,
      });
      return;
    }

    handleAddBlocks(
      parsedBlocks.data,
      parsedParentId.data,
      parsedIndices.data,
      parsedGridMutation.data,
    );
  };

  return {
    handleStageAddBlock,
    handleStageAddBlocks,
    handleStageReorderBlock,
  };
}
