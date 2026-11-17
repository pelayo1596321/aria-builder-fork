import type { Ref } from "vue";
import { z } from "zod";
import type {
  BuilderNode,
  ComponentDSL,
  LayoutDSL,
  PageDSL,
} from "../../../../lib/types/nodes";
import {
  BuilderNodeSchema,
  ComponentDSLSchema,
  PageDSLSchema,
} from "../../../../lib/schemas/nodes";
import { log } from "@/lib/utils/logger";

const StageBlocksSchema = z.array(BuilderNodeSchema);

export interface UseStageContentSyncActionsDeps {
  currentPage: Ref<PageDSL | null>;
  currentLayout: Ref<LayoutDSL | null>;
  loadLayoutForPage: (slug: string) => Promise<LayoutDSL | null>;
  currentComponent: Ref<ComponentDSL | null>;
  lastSavedSnapshot: Ref<string>;
  hasUnsavedChanges: Ref<boolean>;
  pageBlocks: Ref<BuilderNode[]>;
  createSnapshot: (blocks: BuilderNode[]) => string;
}

export interface UseStageContentSyncActionsReturn {
  handleSidebarComponentSaved: (component: ComponentDSL) => void;
  handleSidebarPageSaved: (page: PageDSL) => Promise<void>;
  handleActiveBlocksUpdate: (blocks: BuilderNode[]) => void;
}

export function useStageContentSyncActions(
  deps: UseStageContentSyncActionsDeps,
): UseStageContentSyncActionsReturn {
  const {
    currentPage,
    currentLayout,
    loadLayoutForPage,
    currentComponent,
    lastSavedSnapshot,
    hasUnsavedChanges,
    pageBlocks,
    createSnapshot,
  } = deps;
  let pageLayoutSyncGeneration = 0;

  const handleSidebarComponentSaved = (component: ComponentDSL): void => {
    const parsedComponent = ComponentDSLSchema.safeParse(component);
    if (!parsedComponent.success) {
      log(
        "warn",
        "[useStageContentSyncActions] Ignoring invalid component save payload",
        {
          issues: parsedComponent.error.issues,
        },
      );
      return;
    }

    currentComponent.value = parsedComponent.data;
    lastSavedSnapshot.value = createSnapshot(pageBlocks.value);
    hasUnsavedChanges.value = false;
  };

  const handleSidebarPageSaved = async (page: PageDSL): Promise<void> => {
    const parsedPage = PageDSLSchema.safeParse(page);
    if (!parsedPage.success) {
      log(
        "warn",
        "[useStageContentSyncActions] Ignoring invalid page save payload",
        {
          issues: parsedPage.error.issues,
        },
      );
      return;
    }

    const nextPage = parsedPage.data;
    currentPage.value = nextPage;
    pageBlocks.value = nextPage.nodes ?? [];

    const syncGeneration = ++pageLayoutSyncGeneration;
    const nextLayoutSlug = nextPage.layout?.trim();
    const currentLayoutSlug =
      currentLayout.value?.slug ?? currentLayout.value?.id;
    hasUnsavedChanges.value = true;

    if (!nextLayoutSlug) {
      // A page without an assigned layout must stop exposing the previous
      // layout's slots to Layers and the canvas immediately.
      currentLayout.value = null;
    } else if (currentLayoutSlug !== nextLayoutSlug) {
      // Avoid rendering stale slots while the newly selected layout loads.
      currentLayout.value = null;
      try {
        const nextLayout = await loadLayoutForPage(nextLayoutSlug);
        if (syncGeneration === pageLayoutSyncGeneration) {
          currentLayout.value = nextLayout;
        }
      } catch (error) {
        log("warn", "Failed to sync selected page layout in Composer", {
          slug: nextLayoutSlug,
          error,
        });
      }
    }
  };

  const handleActiveBlocksUpdate = (blocks: BuilderNode[]): void => {
    const parsedBlocks = StageBlocksSchema.safeParse(blocks);
    if (!parsedBlocks.success) {
      log(
        "warn",
        "[useStageContentSyncActions] Ignoring invalid active blocks payload",
        {
          issues: parsedBlocks.error.issues,
        },
      );
      return;
    }

    pageBlocks.value = parsedBlocks.data;
    if (currentPage.value) {
      currentPage.value.nodes = parsedBlocks.data;
    }
  };

  return {
    handleSidebarComponentSaved,
    handleSidebarPageSaved,
    handleActiveBlocksUpdate,
  };
}
