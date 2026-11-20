<script setup lang="ts">
import {
  defineAsyncComponent,
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import { useSettingsDialog } from "@/features/Studio/settings";
import { useHistoryDialog } from "@/features/Studio/history";
import { useRoute } from "vue-router";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useStudioRouter } from "@/features/Studio/core/composables";
import { useStudioSecondaryPanel } from "../composables/useStudioSecondaryPanel";
import {
  formatModifierShortcut,
  formatAltShortcut,
  AGENT_ALT_SHORTCUT_KEY,
  AGENT_SHORTCUT_KEY,
  SIDEBAR_TOGGLE_SHORTCUT_KEY,
} from "@/lib/keyboardShortcuts";
import { useSidebarState } from "@/features/Studio/core/composables/useSidebarState";
import { useSlidingNavIndicator } from "@/features/Studio/core/composables/useSlidingNavIndicator";
import { logoutUser } from "@/features/Auth/composables/useAuthApi";
import { useUser } from "@/features/Auth/composables/useUser";
import { useBuilderData } from "@/composables/useBuilderData";
import { studioIcons } from "@/lib/icons";
import {
  DESIGN_SIDEBAR_CHILDREN,
  type DesignParam,
} from "@/features/Design/types";
import { useSearchDialog } from "@/features/Studio/search";
import { isFeatureEnabled } from "@/lib/features";
import {
  useAgentPanel,
  useAgentAvailability,
  useAgentRuntimeStatus,
  useAgentShellVisibility,
} from "@/features/Agent";
import { useSiteSettings } from "@/composables/useSiteSettings";
import { useStudioI18n } from "@/i18n";
import SidebarLogo from "./SidebarLogo.vue";
import SidebarNavItem from "./SidebarNavItem.vue";
import SidebarNavGroup from "./SidebarNavGroup.vue";
import SidebarUser from "./SidebarUser.vue";
import SlidingNavIndicator from "./SlidingNavIndicator.vue";
import FlickeringNavItem from "./FlickeringNavItem.vue";
import StudioInlineCreateNavRow from "./StudioInlineCreateNavRow.vue";
import { useInjectedPrewarmBuilder } from "@/features/Core/composables/useAppInjectedRuntime";
import { useComponentGrouping } from "@/features/Studio/components/composables/useComponentGrouping";
import { useMediaGrouping } from "@/features/Studio/media/composables/useMediaGrouping";
import {
  countPages,
  type PagesFilter,
} from "@/features/Studio/pages/composables/usePagesListState";
import {
  loadSharedMediaAssets,
  sharedMediaAssets,
} from "@/features/Studio/media/composables/useMediaAssets";
import { matchesActiveFilter } from "@/features/Studio/media/composables/useMediaViewState";
import { isUserComponent } from "@/features/Studio/components/lib/isUserComponent";
import {
  buildComponentsNavChildren,
  isComponentsNavChildActive,
} from "@/features/Studio/components/lib/buildComponentsNavChildren";
import {
  buildMediaNavChildren,
  isMediaNavChildActive,
} from "@/features/Studio/media/lib/buildMediaNavChildren";
import { toMediaListPath } from "@/features/Studio/media/lib/mediaRouteFilter";
import { useCollectionsList } from "@/features/CMS/composables/useCollectionsList";
import {
  prewarmCollection,
  prewarmEntryList,
} from "@/features/CMS/composables/useCmsDataCache";
import {
  buildCollectionsNavChildren,
  isCollectionsNavChildActive,
  type CollectionsNavChild,
} from "@/features/CMS/lib/buildCollectionsNavChildren";

import SettingsDialog from "@/features/Studio/settings/SettingsDialog.vue";
const HistoryDialog = defineAsyncComponent(
  () => import("@/features/Studio/history/HistoryDialog.vue"),
);
const StudioCommandPalette = defineAsyncComponent(
  () => import("@/features/Studio/search/components/StudioCommandPalette.vue"),
);

const prewarmBuilder = useInjectedPrewarmBuilder();
let hasPrewarmedBuilder = false;
let hasRequestedMediaCountAssets = false;
const PREWARM_GROUPS = new Set<string>(["pages", "layouts", "components"]);
function handleNavGroupHover(groupId: string): void {
  if (groupId === "collections") {
    requestCollectionsForSidebar();
  }

  if (groupId === "media" && !hasRequestedMediaCountAssets) {
    hasRequestedMediaCountAssets = true;
    void loadSharedMediaAssets({ source: "StudioSidebar.mediaCounts" }).catch(
      () => {
        hasRequestedMediaCountAssets = false;
      },
    );
  }

  if (!hasPrewarmedBuilder && PREWARM_GROUPS.has(groupId)) {
    hasPrewarmedBuilder = true;
    void prewarmBuilder();
  }
}

const router = useStudioRouter();
const settingsDialog = useSettingsDialog();
const { t } = useStudioI18n();
const { fetchUser } = useUser();
const historyDialog = useHistoryDialog();
const searchDialog = useSearchDialog();
const agentRuntime = useAgentRuntimeStatus();
const agentAvailability = useAgentAvailability();
const agentPanel = useAgentPanel();
const agentWorkingInBackground = computed(
  () => agentRuntime.isWorking.value && !agentPanel.isOpen.value,
);
const { showAgentShell } = useAgentShellVisibility();
const { loadSettings } = useSiteSettings();
void loadSettings();
void agentAvailability.refresh();
const route = useRoute();
const {
  pages,
  layouts,
  components: builderComponents,
  isLoading,
} = useBuilderData();
const {
  isCollapsed,
  isSidebarAnimating,
  openGroups,
  toggleSidebar,
  toggleGroup,
  closeAllGroups,
} = useSidebarState();
const {
  collections,
  isLoading: collectionsLoading,
  loadCollections,
} = useCollectionsList();
let hasRequestedCollectionsForSidebar = false;

function requestCollectionsForSidebar(): void {
  if (hasRequestedCollectionsForSidebar || collectionsLoading.value) return;
  hasRequestedCollectionsForSidebar = true;
  void loadCollections();
}

function prewarmSidebarCollection(child: CollectionsNavChild): void {
  if (!child.collectionName) return;
  prewarmCollection(child.collectionName);
  const collection = collections.value.find(
    (item) => item.name === child.collectionName,
  );
  if (!collection) return;
  prewarmEntryList({
    collectionId: collection.id,
    page: 1,
    limit: 50,
    sort: [{ field: "updatedAt", direction: "desc" }],
  });
}

watch(
  () => route.path,
  (path) => {
    if (path === "/dashboard") {
      closeAllGroups();
      openGroups.value["online-store"] = true;
    }
    if (path.startsWith("/components")) {
      openGroups.value.components = true;
    }
    if (path.startsWith("/collections")) {
      openGroups.value.collections = true;
      requestCollectionsForSidebar();
    }
  },
  { immediate: true },
);

const userComponents = computed(() =>
  builderComponents.value.filter(isUserComponent),
);

const componentGrouping = useComponentGrouping(userComponents);
const mediaGrouping = useMediaGrouping(computed(() => []));

async function createSidebarComponentGroup(name: string): Promise<void> {
  await componentGrouping.createCustomGroup(name);
}

async function createSidebarMediaFolder(name: string): Promise<void> {
  await mediaGrouping.createCustomGroup(name);
}

const componentsNavChildren = computed(() => {
  if (!componentGrouping.canReadGrouping.value) {
    return buildComponentsNavChildren([]).map((child) => ({
      ...child,
      label: child.filter === "all" ? t("sidebar.allComponents") : child.label,
    }));
  }
  return buildComponentsNavChildren(componentGrouping.customGroups.value).map(
    (child) => ({
      ...child,
      label: child.filter === "all" ? t("sidebar.allComponents") : child.label,
    }),
  );
});

const isComponentsRoute = computed(() => route.path.startsWith("/components"));
const shouldAnimateSidebarWidth = computed(() => !isComponentsRoute.value);

const mediaNavChildren = computed(() => {
  const typeChildren = buildMediaNavChildren().map((child) => ({
    ...child,
    label: mediaNavLabel(child.filter),
  }));
  if (!mediaGrouping.canReadGrouping.value) return typeChildren;

  return [
    ...typeChildren,
    ...mediaGrouping.customGroups.value.map((group) => ({
      label: group.name,
      path: toMediaListPath({ group: group.id }),
      groupId: group.id,
      section: "folder" as const,
    })),
  ];
});

function getComponentNavCount(
  child: (typeof componentsNavChildren.value)[number],
): number {
  if (child.groupId) {
    return componentGrouping.getGroupMemberCount(
      child.groupId,
      userComponents.value,
    );
  }
  return userComponents.value.length;
}

function getMediaNavCount(
  child: (typeof mediaNavChildren.value)[number],
): number {
  if (child.groupId) {
    return mediaGrouping.getGroupMemberCount(
      child.groupId,
      sharedMediaAssets.value,
    );
  }
  const filter = child.filter ?? "all";
  return sharedMediaAssets.value.filter((asset) =>
    matchesActiveFilter(asset, filter),
  ).length;
}

function getCollectionEntryCount(child: CollectionsNavChild): number {
  if (!child.collectionName) {
    return collections.value.reduce(
      (total, collection) => total + collection.itemCount,
      0,
    );
  }
  return (
    collections.value.find(
      (collection) => collection.name === child.collectionName,
    )?.itemCount ?? 0
  );
}

function formatEntryCount(count: number): string {
  return count === 1
    ? t("collections.oneEntry")
    : t("collections.entryCount", { count });
}
const collectionsNavChildren = computed(() =>
  buildCollectionsNavChildren(collections.value).map((child) => ({
    ...child,
    label: child.collectionName ? child.label : t("sidebar.allCollections"),
  })),
);

function mediaNavLabel(filter: string | undefined): string {
  switch (filter) {
    case "image":
      return t("media.filter.images");
    case "video":
      return t("media.filter.videos");
    case "font":
      return t("media.filter.fonts");
    case "icon":
      return t("media.filter.icons");
    case "file":
      return t("media.filter.files");
    default:
      return t("media.sidebar.all");
  }
}

function designNavLabel(param: DesignParam): string {
  switch (param) {
    case "colors":
      return t("design.section.colors");
    case "typography":
      return t("design.section.typography");
    case "globals":
      return t("design.section.globalStyles");
    case "icons":
      return t("design.section.icons");
    case "breakpoints":
      return t("design.section.breakpoints");
    case "framework":
      return t("design.section.framework");
    case "classes":
      return t("design.section.classManager");
    case "variables":
      return t("design.section.variableManager");
  }
}

const detailComponentSlug = computed(() => {
  const match = route.path.match(/^\/components\/([^/]+)$/);
  return match?.[1] ?? null;
});

const detailAssignmentGroupId = computed(() => {
  if (!detailComponentSlug.value) {
    return null;
  }
  const effective = componentGrouping.buildEffectiveAssignments(
    userComponents.value,
  );
  return effective[detailComponentSlug.value] ?? null;
});

watch(
  () => settingsDialog.isOpen.value,
  (open, wasOpen) => {
    if (wasOpen && !open && settingsDialog.sessionProfileDirty.value) {
      void fetchUser({ force: true });
      settingsDialog.clearSessionProfileDirty();
    }
  },
);

function isActive(path: string): boolean {
  if (path === "/") return route.path === "/";
  return route.path === path || route.path.startsWith(path + "/");
}

function isGroupActive(path: string): boolean {
  if (path === "/online-store") return isOnlineStoreRoute.value;
  return route.path.startsWith(path);
}

function navigateTo(path: string) {
  if (path === "/settings") {
    settingsDialog.open();
    return;
  }
  if (path === "/history") {
    historyDialog.open();
    return;
  }
  if (path === "/search") {
    searchDialog.open();
    return;
  }
  router.navigateTo(path);
}

function openSearch(): void {
  searchDialog.open();
}

const sidebarActionTooltipSide = computed(() =>
  isCollapsed.value ? "right" : "top",
);

const sidebarActions = computed(() => {
  const actions: Array<{
    id: string;
    label: string;
    shortcut?: string;
    icon: string;
    onClick: () => void;
  }> = [];

  if (showAgentShell.value) {
    actions.push({
      id: "agent",
      label: t("sidebar.agent"),
      shortcut: AGENT_SHORTCUT_KEY,
      icon: studioIcons.sparkles,
      onClick: () => agentPanel.toggle(),
    });
  }

  actions.push(
    {
      id: "toggle",
      label: isCollapsed.value ? t("sidebar.expand") : t("sidebar.collapse"),
      shortcut: SIDEBAR_TOGGLE_SHORTCUT_KEY,
      icon: isCollapsed.value ? studioIcons.expand : studioIcons.collapse,
      onClick: toggleSidebar,
    },
    {
      id: "search",
      label: t("sidebar.search"),
      shortcut: formatModifierShortcut("K"),
      icon: studioIcons.search,
      onClick: openSearch,
    },
    {
      id: "settings",
      label: t("sidebar.settings"),
      shortcut: formatModifierShortcut(","),
      icon: studioIcons.settings,
      onClick: () => settingsDialog.open(),
    },
  );

  return actions;
});

/**
 * Whether a specific Design sub-section is the active one.
 * Matches bare query keys: ?colors, ?typography, ?globals, etc.
 */
function isDesignChildActive(param: DesignParam): boolean {
  return param in route.query;
}

async function handleLogout() {
  const result = await logoutUser();
  if ("success" in result) {
    window.location.href = "/admin/login";
  }
}

function expandSidebarForGroup(groupId: string): void {
  if (!isCollapsed.value) {
    toggleGroup(groupId);
    return;
  }

  toggleSidebar();
  void nextTick(() => {
    closeAllGroups();
    openGroups.value[groupId] = true;
    if (groupId === "online-store") navigateTo("/store-general");
  });
}

function getFirstSubmenuPath(groupId: string): string | undefined {
  switch (groupId) {
    case "online-store":
      return onlineStoreChildren.value[0]?.path;
    case "pages":
      return pageNavChildren.value[0]?.path;
    case "layouts":
      return layoutNavChildren.value[0]?.path;
    case "components":
      return componentsNavChildren.value[0]?.path;
    case "collections":
      return collectionsNavChildren.value[0]?.path;
    case "media":
      return mediaNavChildren.value[0]?.path;
    case "design": {
      const firstSection = DESIGN_SIDEBAR_CHILDREN[0];
      return firstSection ? `/design?${firstSection.param}` : undefined;
    }
    default:
      return undefined;
  }
}

function toggleSidebarGroup(groupId: string): void {
  if (groupId === "online-store") {
    if (openGroups.value[groupId]) {
      closeAllGroups();
      return;
    }

    closeAllGroups();
    openGroups.value[groupId] = true;
    const firstSubmenuPath = getFirstSubmenuPath(groupId);
    if (firstSubmenuPath) router.navigateTo(firstSubmenuPath);
    return;
  }

  const isOpening = !openGroups.value[groupId];
  toggleGroup(groupId);
  if (!isOpening) return;

  const firstSubmenuPath = getFirstSubmenuPath(groupId);
  if (firstSubmenuPath) router.navigateTo(firstSubmenuPath);
}

function selectOnlineStoreChild(path: string): void {
  hideCollapsedSidebarHoverMenu();

  if (isCollapsed.value) {
    openGroups.value["online-store"] = true;
    showCollapsedSubmenuPanel.value = true;
    navigateTo(path);
    return;
  }

  navigateTo(path);
}

interface SidebarFilterChild {
  label: string;
  path: string;
  filter?: string;
}

const pageNavChildren = computed<SidebarFilterChild[]>(() => [
  { label: t("sidebar.allPages"), path: "/pages" },
  {
    label: t("sidebar.published"),
    path: "/pages?filter=published",
    filter: "published",
  },
  { label: t("sidebar.draft"), path: "/pages?filter=draft", filter: "draft" },
  {
    label: t("sidebar.scheduled"),
    path: "/pages?filter=scheduled",
    filter: "scheduled",
  },
  {
    label: t("sidebar.archived"),
    path: "/pages?filter=archived",
    filter: "archived",
  },
  {
    label: t("sidebar.modified"),
    path: "/pages?filter=modified",
    filter: "modified",
  },
]);
const pageCounts = computed(() => countPages(pages.value));

function getPageNavCount(child: SidebarFilterChild): number {
  return pageCounts.value[(child.filter ?? "all") as PagesFilter];
}

const layoutNavChildren = computed<SidebarFilterChild[]>(() => [
  { label: t("sidebar.allLayouts"), path: "/layouts" },
  { label: t("sidebar.used"), path: "/layouts?filter=used", filter: "used" },
  {
    label: t("sidebar.unused"),
    path: "/layouts?filter=unused",
    filter: "unused",
  },
]);

function isSidebarFilterChildActive(
  child: SidebarFilterChild,
  basePath: string,
): boolean {
  if (route.query.filter !== child.filter) return false;
  if (child.filter !== undefined) return true;
  return route.path === basePath;
}

const sectionNavItems = computed(() => {
  const items = [
    {
      type: "group" as const,
      label: t("sidebar.pages"),
      path: "/pages",
      icon: studioIcons.pages,
      groupId: "pages",
    },
    {
      type: "group" as const,
      label: t("sidebar.components"),
      path: "/components",
      icon: studioIcons.components,
      groupId: "components",
    },
    ...(isFeatureEnabled("studio.layouts")
      ? [
          {
            type: "group" as const,
            label: t("sidebar.layouts"),
            path: "/layouts",
            icon: studioIcons.layouts,
            groupId: "layouts",
          },
        ]
      : []),
    {
      type: "group" as const,
      label: t("sidebar.collections"),
      path: "/collections",
      icon: studioIcons.collections,
      groupId: "collections",
    },
    {
      type: "group" as const,
      label: t("sidebar.media"),
      path: "/media",
      icon: studioIcons.media,
      groupId: "media",
    },
    {
      type: "group" as const,
      label: t("sidebar.design"),
      path: "/design",
      icon: studioIcons.design,
      groupId: "design",
    },
  ];

  return items;
});

const onlineStoreChildren = computed(() => [
  { label: "General", path: "/store-general" },
  { label: "Appearance", path: "/appearance" },
  { label: "Site structure", path: "/site-structure" },
  ...(isFeatureEnabled("studio.layouts")
    ? [{ label: t("sidebar.layouts"), path: "/layouts" }]
    : []),
]);
type CollapsedSidebarHoverMenu = {
  title: string;
  left: number;
  top: number;
  children: Array<{ label: string; path: string }>;
};
const collapsedSidebarHoverMenu = ref<CollapsedSidebarHoverMenu | null>(null);
let collapsedSidebarHoverTimeout: ReturnType<typeof setTimeout> | null = null;

const collapsedSidebarHoverMenuStyle = computed(() => {
  const menu = collapsedSidebarHoverMenu.value;
  if (!menu) return {};

  const estimatedHeight =
    menu.children.length > 0 ? 44 + menu.children.length * 36 : 40;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  return {
    left: `${menu.left}px`,
    top: `${Math.max(8, Math.min(menu.top, viewportHeight - estimatedHeight - 8))}px`,
  };
});

function showCollapsedSidebarHoverMenu(
  title: string,
  event: MouseEvent,
  children: Array<{ label: string; path: string }> = [],
): void {
  if (!isCollapsed.value || !(event.currentTarget instanceof HTMLElement))
    return;
  if (collapsedSidebarHoverTimeout) {
    clearTimeout(collapsedSidebarHoverTimeout);
    collapsedSidebarHoverTimeout = null;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  collapsedSidebarHoverMenu.value = {
    title,
    left: rect.right + 6,
    top: rect.top,
    children,
  };
}

function scheduleHideCollapsedSidebarHoverMenu(): void {
  if (collapsedSidebarHoverTimeout) clearTimeout(collapsedSidebarHoverTimeout);
  collapsedSidebarHoverTimeout = setTimeout(() => {
    collapsedSidebarHoverMenu.value = null;
    collapsedSidebarHoverTimeout = null;
  }, 180);
}

function keepCollapsedSidebarHoverMenuOpen(): void {
  if (collapsedSidebarHoverTimeout) {
    clearTimeout(collapsedSidebarHoverTimeout);
    collapsedSidebarHoverTimeout = null;
  }
}

function hideCollapsedSidebarHoverMenu(): void {
  if (collapsedSidebarHoverTimeout) {
    clearTimeout(collapsedSidebarHoverTimeout);
    collapsedSidebarHoverTimeout = null;
  }
  collapsedSidebarHoverMenu.value = null;
}

onBeforeUnmount(hideCollapsedSidebarHoverMenu);

const commerceNavItems = [
  { label: "Home", path: "/inicio", icon: "i-hugeicons:home-02" },
  { label: "Orders", path: "/orders", icon: "i-hugeicons:invoice-01" },
  { label: "Products", path: "/products", icon: "i-hugeicons:tag-01" },
  { label: "Customers", path: "/customers", icon: "i-hugeicons:user-group" },
  { label: "Marketing", path: "/marketing", icon: "i-hugeicons:megaphone-01" },
  {
    label: "Discounts",
    path: "/discounts",
    icon: "i-hugeicons:discount-tag-01",
  },
  { label: "Analytics", path: "/reports", icon: "i-hugeicons:analytics-01" },
];
const showCollapsedSubmenuPanel = ref(false);
const isOnlineStoreRoute = computed(
  () =>
    route.path === "/dashboard" ||
    route.path === "/store-general" ||
    route.path === "/appearance" ||
    route.path === "/site-structure" ||
    sectionNavItems.value.some(
      (item) => item.type === "group" && isGroupActive(item.path),
    ),
);
const secondaryPanel = useStudioSecondaryPanel();
const isAppearanceRoute = computed(() =>
  route.path === "/appearance" || route.path === "/design" || route.path.startsWith("/design/"),
);

const siteStructureItems = [
  { label: "Architecture", path: "/site-structure" },
  { label: "Pages", path: "/pages" },
  { label: "Components", path: "/components" },
  { label: "Collections", path: "/collections" },
  { label: "Media", path: "/media" },
];
const isSiteStructureRoute = computed(() =>
  siteStructureItems.some(({ path }) =>
    route.path === path || route.path.startsWith(`${path}/`),
  ),
);

const openSubmenuItem = computed(() =>
  route.path === "/products"
    ? { type: "group" as const, label: "Products", path: "/products", groupId: "products" }
  : route.path === "/dashboard" || route.path === "/store-general"
    ? {
        type: "group" as const,
        label: "General",
        path: "/store-general",
        groupId: "store-general",
      }
    : isAppearanceRoute.value || isSiteStructureRoute.value
      ? {
          type: "group" as const,
          label: isAppearanceRoute.value ? "Appearance" : "Site structure",
          path: isAppearanceRoute.value ? "/appearance" : "/site-structure",
          groupId: isAppearanceRoute.value ? "appearance" : "site-structure",
        }
    : sectionNavItems.value.find(
        (item) => item.type === "group" && isGroupActive(item.path),
      ),
);
const showSubmenuPanel = computed(
  () =>
    (!isCollapsed.value ||
      showCollapsedSubmenuPanel.value ||
      route.path === "/products" ||
      isOnlineStoreRoute.value) &&
    Boolean(openSubmenuItem.value),
);

watch(
  [() => openSubmenuItem.value?.label, showSubmenuPanel],
  ([title, visible]) => secondaryPanel.setPanel(title ?? "", visible),
  { immediate: true },
);

onBeforeUnmount(() => secondaryPanel.setPanel("", false));

watch(
  () => route.path,
  () => {
    if (isOnlineStoreRoute.value) {
      openGroups.value["online-store"] = true;
    } else {
      closeAllGroups();
      showCollapsedSubmenuPanel.value = false;
    }
  },
  { immediate: true },
);

watch(
  isCollapsed,
  (collapsed) => {
    if (!collapsed) {
      hideCollapsedSidebarHoverMenu();
      showCollapsedSubmenuPanel.value = false;
      closeAllGroups();
      if (isOnlineStoreRoute.value) openGroups.value["online-store"] = true;
    } else {
      showCollapsedSubmenuPanel.value = false;
    }
  },
  { immediate: true },
);

const activeNavKey = computed(() => {
  const selectedCommerceItem = commerceNavItems.find((item) =>
    isActive(item.path),
  );
  if (selectedCommerceItem) return selectedCommerceItem.path;
  if (isOnlineStoreRoute.value) return "/online-store";
  return null;
});

const {
  navRef: sidebarNavRef,
  indicator: sidebarNavIndicator,
  indicatorAnimated: sidebarNavIndicatorAnimated,
  registerButton: registerSidebarNavButton,
  onItemEnter: onSidebarNavEnter,
  onNavLeave: onSidebarNavLeave,
  updateIndicator: updateSidebarNavIndicator,
} = useSlidingNavIndicator({
  enabled: computed(() => true),
  activeKey: activeNavKey,
  paused: computed(
    () => shouldAnimateSidebarWidth.value && isSidebarAnimating.value,
  ),
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isCollapsed && collapsedSidebarHoverMenu"
      class="fixed z-[100] w-48 overflow-hidden rounded-md border border-solid border-sidebar-border bg-background text-foreground shadow-xl"
      :style="collapsedSidebarHoverMenuStyle"
      @mouseenter="keepCollapsedSidebarHoverMenuOpen"
      @mouseleave="scheduleHideCollapsedSidebarHoverMenu"
    >
      <div
        class="flex h-10 items-center border-b border-sidebar-border/70 bg-sidebar-accent/20 px-4 text-sm font-semibold text-foreground"
      >
        {{ collapsedSidebarHoverMenu.title }}
      </div>
      <FlickeringNavItem
        v-for="child in collapsedSidebarHoverMenu.children"
        :key="child.path"
        :active="isActive(child.path.split('?')[0])"
        :show-grid="false"
        class="h-9! min-h-9! px-4!"
        @click="selectOnlineStoreChild(child.path)"
      >
        <span class="truncate">{{ child.label }}</span>
      </FlickeringNavItem>
    </div>
  </Teleport>

  <div
    class="studio-sidebar-shell"
    :style="{
      width: isCollapsed ? '3rem' : '15rem',
      minWidth: isCollapsed ? '3rem' : '15rem',
      flex: isCollapsed ? '0 0 3rem' : '0 0 15rem',
    }"
  >
    <aside
      :class="[
        'studio-sidebar admin-sidebar-height relative z-20 flex shrink-0 flex-col bg-sidebar py-4 text-sidebar-foreground',
        shouldAnimateSidebarWidth
          ? 'transition-[width] duration-200 ease-in-out'
          : 'transition-none',
        isSidebarAnimating &&
          shouldAnimateSidebarWidth &&
          'studio-sidebar--animating',
      ]"
      :style="{
        viewTransitionName: 'none',
        width: isCollapsed ? '3rem' : '15rem',
        minWidth: isCollapsed ? '3rem' : '15rem',
      }"
    >
      <SidebarLogo
        :collapsed="isCollapsed"
        @navigate="navigateTo('/dashboard')"
      />

      <nav
        ref="sidebarNavRef"
        :class="[
          'sidebar-nav relative flex min-h-0 flex-1 flex-col overflow-y-auto py-4',
          'justify-start gap-1',
        ]"
        @scroll="!isSidebarAnimating && updateSidebarNavIndicator()"
        @mouseleave="onSidebarNavLeave"
      >
        <SlidingNavIndicator
          :visible="sidebarNavIndicator.visible"
          :top="sidebarNavIndicator.top"
          :height="sidebarNavIndicator.height"
          :animated="sidebarNavIndicatorAnimated"
        />

        <div
          class="flex h-6 shrink-0 items-end px-4 pb-1 pt-2 text-[10px] leading-3 font-medium uppercase tracking-wider text-muted-foreground/50"
          :aria-hidden="isCollapsed ? 'true' : undefined"
        >
          <span :class="isCollapsed && 'invisible'">Main</span>
        </div>

        <SidebarNavItem
          v-for="item in commerceNavItems"
          :key="item.path"
          :label="item.label"
          :path="item.path"
          :icon="item.icon"
          :active="isActive(item.path)"
          :collapsed="isCollapsed"
          :indicator-id="item.path"
          @mouseenter="showCollapsedSidebarHoverMenu(item.label, $event)"
          @mouseleave="scheduleHideCollapsedSidebarHoverMenu"
          @click="hideCollapsedSidebarHoverMenu"
          @navigate="navigateTo"
          @register-indicator="registerSidebarNavButton"
          @indicator-enter="onSidebarNavEnter"
        />

        <div
          class="relative flex h-9 shrink-0 items-end px-4 pb-1 pt-5 text-[10px] leading-3 font-medium uppercase tracking-wider text-muted-foreground/50"
          :aria-hidden="isCollapsed ? 'true' : undefined"
        >
          <span :class="isCollapsed && 'invisible'">Sales Channels</span>
          <span
            v-if="isCollapsed"
            class="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-sidebar-foreground/15"
            aria-hidden="true"
          />
        </div>

        <SidebarNavGroup
          label="Online Store"
          :icon="studioIcons.store"
          group-id="online-store"
          :open="Boolean(openGroups['online-store'])"
          :active="isOnlineStoreRoute"
          :collapsed="isCollapsed"
          indicator-id="/online-store"
          inline-children
          @collapsed-hover="
            showCollapsedSidebarHoverMenu(
              'Online Store',
              $event,
              onlineStoreChildren,
            )
          "
          @collapsed-leave="scheduleHideCollapsedSidebarHoverMenu"
          @expand="expandSidebarForGroup"
          @toggle="toggleSidebarGroup"
          @register-indicator="registerSidebarNavButton"
          @indicator-enter="onSidebarNavEnter"
        >
          <template #children>
            <FlickeringNavItem
              v-for="child in onlineStoreChildren"
              :key="child.path"
              :active="isActive(child.path.split('?')[0]) || (child.path === '/store-general' && route.path === '/dashboard') || (child.path === '/site-structure' && isSiteStructureRoute) || (child.path === '/appearance' && isAppearanceRoute)"
              class="h-10! min-h-10! !py-2 !pl-10"
              @click="selectOnlineStoreChild(child.path)"
            >
              <span class="min-w-0 truncate">{{ child.label }}</span>
            </FlickeringNavItem>
          </template>
        </SidebarNavGroup>

        <div class="hidden">
          <template v-for="item in sectionNavItems" :key="item.label">
            <SidebarNavItem
              v-if="item.type === 'item'"
              :label="item.label"
              :path="item.path"
              :icon="item.icon"
              :active="isActive(item.path)"
              :collapsed="isCollapsed && !showCollapsedSubmenuPanel"
              :indicator-id="item.path"
              @navigate="navigateTo"
              @register-indicator="registerSidebarNavButton"
              @indicator-enter="onSidebarNavEnter"
            />
            <SidebarNavGroup
              v-else
              :label="item.label"
              :icon="item.icon"
              :group-id="item.groupId"
              :open="isGroupActive(item.path)"
              :active="isGroupActive(item.path)"
              :collapsed="isCollapsed"
              :indicator-id="item.path"
              :render-children="
                secondaryPanel.hostReady.value &&
                openSubmenuItem?.groupId === item.groupId &&
                !(
                  item.groupId === 'components' &&
                  shouldAnimateSidebarWidth &&
                  isSidebarAnimating
                )
              "
              @expand="expandSidebarForGroup"
              @toggle="toggleSidebarGroup"
              @hover="handleNavGroupHover"
              @register-indicator="registerSidebarNavButton"
              @indicator-enter="onSidebarNavEnter"
            >
              <template #children>
                <!-- Pages -->
                <div
                  v-if="item.groupId === 'pages'"
                  class="ml-5.3 flex flex-col py-2 gap-0 border-l border-border border-dashed pl-4"
                >
                  <FlickeringNavItem
                    v-for="child in pageNavChildren"
                    :key="child.label"
                    :active="isSidebarFilterChildActive(child, '/pages')"
                    class="py-4.5"
                    @click="navigateTo(child.path)"
                  >
                    <span class="min-w-0 truncate">{{ child.label }}</span>
                    <span
                      class="shrink-0 text-2xs tabular-nums text-muted-foreground/40"
                    >
                      {{ getPageNavCount(child) }}
                    </span>
                  </FlickeringNavItem>
                </div>

                <!-- Layouts -->
                <div
                  v-if="item.groupId === 'layouts'"
                  class="ml-5.3 flex flex-col py-2 gap-0 border-l border-border border-dashed pl-4"
                >
                  <FlickeringNavItem
                    v-for="child in layoutNavChildren"
                    :key="child.label"
                    :active="isSidebarFilterChildActive(child, '/layouts')"
                    class="py-4.5"
                    @click="navigateTo(child.path)"
                  >
                    <span class="min-w-0 truncate">{{ child.label }}</span>
                  </FlickeringNavItem>
                </div>

                <!-- Components -->
                <div
                  v-if="item.groupId === 'components'"
                  class="ml-5.3 flex flex-col py-2 gap-0 border-l border-border border-dashed pl-4"
                >
                  <FlickeringNavItem
                    v-for="child in componentsNavChildren"
                    :key="child.path"
                    :active="
                      isComponentsNavChildActive(
                        child,
                        route.path,
                        route.query.filter,
                        detailAssignmentGroupId,
                      )
                    "
                    class="py-4.5"
                    :title="child.label"
                    @focusin="prewarmSidebarCollection(child)"
                    @mouseenter="prewarmSidebarCollection(child)"
                    @click="navigateTo(child.path)"
                  >
                    <span class="min-w-0 truncate">{{ child.label }}</span>
                    <span
                      class="shrink-0 text-2xs tabular-nums text-muted-foreground/40"
                    >
                      {{ getComponentNavCount(child) }}
                    </span>
                  </FlickeringNavItem>
                  <StudioInlineCreateNavRow
                    v-if="componentGrouping.canUpdateGrouping.value"
                    :label="t('components.sidebar.newGroup')"
                    :placeholder="t('components.sidebar.groupName')"
                    :hint="t('media.sidebar.createHint')"
                    @create="createSidebarComponentGroup"
                  />
                </div>

                <!-- Collections -->
                <div
                  v-if="item.groupId === 'collections'"
                  class="ml-5.3 flex flex-col py-2 gap-0 border-l border-border border-dashed pl-4"
                >
                  <FlickeringNavItem
                    v-for="child in collectionsNavChildren"
                    :key="child.path"
                    :active="isCollectionsNavChildActive(child, route.path)"
                    class="py-4.5"
                    :title="child.label"
                    @click="navigateTo(child.path)"
                  >
                    <div class="flex min-w-0 flex-col items-start gap-1">
                      <span class="min-w-0 truncate">{{ child.label }}</span>
                      <span class="text-xs text-muted-foreground/60">
                        {{ formatEntryCount(getCollectionEntryCount(child)) }}
                      </span>
                    </div>
                    <span
                      v-if="!child.collectionName"
                      class="shrink-0 text-2xs tabular-nums text-muted-foreground/40"
                      :aria-label="`${collections.length} collections`"
                    >
                      {{ collections.length }}
                    </span>
                  </FlickeringNavItem>
                </div>

                <!-- Media -->
                <div
                  v-if="item.groupId === 'media'"
                  class="ml-5.3 flex flex-col py-2 gap-0 border-l border-border border-dashed pl-4"
                >
                  <FlickeringNavItem
                    v-for="child in mediaNavChildren"
                    :key="child.path"
                    :active="
                      isMediaNavChildActive(
                        child,
                        route.path,
                        route.query.filter,
                        route.query.group,
                      )
                    "
                    class="py-4.5"
                    :title="child.label"
                    @click="navigateTo(child.path)"
                  >
                    <span class="min-w-0 truncate">{{ child.label }}</span>
                    <span
                      class="shrink-0 text-2xs tabular-nums text-muted-foreground/40"
                    >
                      {{ getMediaNavCount(child) }}
                    </span>
                  </FlickeringNavItem>
                  <StudioInlineCreateNavRow
                    v-if="mediaGrouping.canUpdateGrouping.value"
                    :label="t('media.sidebar.newFolder')"
                    :placeholder="t('media.sidebar.folderName')"
                    :hint="t('media.sidebar.createHint')"
                    @create="createSidebarMediaFolder"
                  />
                </div>

                <!-- Design — 100% typed via DESIGN_SIDEBAR_CHILDREN -->
                <div
                  v-if="item.groupId === 'design'"
                  :class="[
                    'ml-5.3 py-2 pb-4 flex flex-col gap-0 border-l border-border border-dashed pl-4',
                    { 'border-b': !isCollapsed },
                  ]"
                >
                  <FlickeringNavItem
                    v-for="child in DESIGN_SIDEBAR_CHILDREN"
                    :key="child.param"
                    :active="isDesignChildActive(child.param)"
                    class="py-4.5"
                    @click="navigateTo(`/design?${child.param}`)"
                  >
                    <span class="min-w-0 truncate">{{
                      designNavLabel(child.param)
                    }}</span>
                  </FlickeringNavItem>
                </div>
              </template>
            </SidebarNavGroup>
          </template>
        </div>
      </nav>

      <!-- Spacer -->
      <div class="shrink-0 h-3" />

      <!-- Sidebar Actions -->
      <div
        :class="[
          'shrink-0',
          isCollapsed
            ? 'flex flex-col items-center gap-2 py-2'
            : 'pl-2 mx-2 flex flex-row items-center justify-start gap-2 py-0',
        ]"
      >
        <TooltipProvider
          :delay-duration="0"
          :skip-delay-duration="0"
          :disable-hoverable-content="true"
        >
          <Tooltip v-for="action in sidebarActions" :key="action.id">
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="sidebar-action"
                size="xs"
                :class="[
                  'relative',
                  action.id === 'agent' && agentWorkingInBackground
                    ? 'agent-streaming'
                    : '',
                ]"
                :aria-label="action.label"
                @click="action.onClick"
              >
                <span
                  :class="[
                    action.icon,
                    'size-3 shrink-0',
                    action.id === 'agent' && agentWorkingInBackground
                      ? 'text-primary'
                      : '',
                  ]"
                />
                <span
                  v-if="
                    action.id === 'agent' &&
                    agentWorkingInBackground &&
                    agentRuntime.isBuilding.value &&
                    agentRuntime.completedSectionCount.value > 0
                  "
                  data-testid="studio-agent-build-count"
                  class="pointer-events-none absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-semibold leading-4 text-primary-foreground"
                >
                  {{ agentRuntime.completedSectionCount.value }}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent
              :side="sidebarActionTooltipSide"
              :side-offset="8"
              class="flex items-center gap-2 whitespace-nowrap"
            >
              {{ action.label }}
              <span
                v-if="action.shortcut"
                class="font-mono text-[10px] text-muted-foreground/70"
              >
                {{ action.shortcut }}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <SidebarUser
        :collapsed="isCollapsed"
        @navigate="navigateTo"
        @logout="handleLogout"
      />
    </aside>
  </div>

  <SettingsDialog />
  <HistoryDialog v-if="historyDialog.isOpen.value" />

  <Teleport
    v-if="secondaryPanel.hostReady.value && route.path === '/products'"
    to="#studio-sidebar-submenu-items"
    defer
  >
    <FlickeringNavItem
      v-for="item in [{ label: 'All products', section: 'all' }, { label: 'Categories', section: 'categories' }, { label: 'Variants', section: 'variants' }, { label: 'Tags', section: 'tags' }, { label: 'Reviews', section: 'reviews' }]"
      :key="item.section"
      :active="(route.query.section || 'all') === item.section"
      class="py-4.5"
      @click="navigateTo(item.section === 'all' ? '/products' : `/products?section=${item.section}`)"
    ><span>{{ item.label }}</span></FlickeringNavItem>
  </Teleport>

  <Teleport
    v-if="secondaryPanel.hostReady.value && (route.path === '/store-general' || route.path === '/dashboard')"
    to="#studio-sidebar-submenu-items"
    defer
  >
    <FlickeringNavItem :active="route.path === '/store-general'" class="py-4.5" @click="navigateTo('/store-general')">
      <span>Settings</span>
    </FlickeringNavItem>
    <FlickeringNavItem :active="route.path === '/dashboard'" class="py-4.5" @click="navigateTo('/dashboard')">
      <span>Dashboard</span>
    </FlickeringNavItem>
  </Teleport>

  <Teleport
    v-if="secondaryPanel.hostReady.value && isSiteStructureRoute"
    to="#studio-sidebar-submenu-items"
    defer
  >
    <FlickeringNavItem
      v-for="item in siteStructureItems"
      :key="item.label"
      :active="route.path === item.path || route.path.startsWith(`${item.path}/`)"
      class="py-4.5"
      @click="navigateTo(item.path)"
    >
      <span class="min-w-0 truncate">{{ item.label }}</span>
    </FlickeringNavItem>
  </Teleport>

  <Teleport v-if="secondaryPanel.hostReady.value && isAppearanceRoute" to="#studio-sidebar-submenu-items" defer>
    <FlickeringNavItem :active="route.path === '/appearance'" class="py-4.5" @click="navigateTo('/appearance')">
      <span>Theme</span>
    </FlickeringNavItem>
    <FlickeringNavItem
      v-for="child in DESIGN_SIDEBAR_CHILDREN"
      :key="child.param"
      :active="route.path === '/design' && isDesignChildActive(child.param)"
      class="py-4.5"
      @click="navigateTo(`/design?${child.param}`)"
    >
      <span class="min-w-0 truncate">{{ designNavLabel(child.param) }}</span>
    </FlickeringNavItem>
  </Teleport>

  <!-- Command Palette — mounted when search is open -->
  <StudioCommandPalette
    v-if="searchDialog.isOpen.value"
    :pages="pages"
    :layouts="layouts"
    :components="builderComponents"
    :is-loading="isLoading"
  />
</template>

<style scoped>
.admin-sidebar-height {
  height: 100vh;
}

.studio-sidebar-shell {
  display: flex;
  flex: 0 0 3rem;
  align-items: stretch;
  gap: 0.375rem;
  width: 3rem;
  min-width: 3rem;
  height: 100vh;
  position: relative;
  z-index: 20;
  overflow: visible;
}

@supports (height: 100dvh) {
  .admin-sidebar-height {
    height: 100dvh;
  }

  .studio-sidebar-shell {
    height: 100dvh;
  }
}

.studio-sidebar--animating {
  will-change: width;
}

:deep(.sidebar-nav-target.nav-border-inactive),
:deep(.sidebar-nav-target.hover\:nav-border-hover:hover) {
  box-shadow: inset 2px 0 0 0 transparent !important;
}
</style>

<style>
.agent-streaming {
  animation: sidebar-agent-pulse 1.2s ease-in-out infinite;
}

@keyframes sidebar-agent-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}
</style>
