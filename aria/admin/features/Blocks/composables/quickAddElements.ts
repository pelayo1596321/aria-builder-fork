import { studioIcons } from "@/lib/icons";
import { createIconListNode, createListNode } from "../../../../lib/blocks/listNodes";
import { createNavigationNode } from "../../../../lib/blocks/navigationNodes";
import { createPaginationNode } from "../../../../lib/blocks/paginationNodes";
import type { BuilderNode, JsonObject } from "../../../../lib/types/nodes";

export interface QuickAddElement {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly icon: string;
  readonly createData: () => Partial<BuilderNode>;
}

const USAGE_STORAGE_KEY = "aria:composer:quick-add-usage:v1";
export const QUICK_ADD_USAGE_CHANGED_EVENT = "aria:quick-add-usage-changed";

const baseNode = (
  type: string,
  props: JsonObject,
): Partial<BuilderNode> => ({
  type,
  props,
  classNames: { base: [] },
  customClasses: [],
  styles: {},
  children: [],
});

export const QUICK_ADD_CONTAINER: QuickAddElement = {
  id: "container",
  label: "Container",
  type: "Container",
  icon: "i-lucide:box-select",
  createData: () => baseNode("Container", { element: "div" }),
};

const QUICK_ADD_PRIMITIVES: readonly QuickAddElement[] = [
  {
    id: "heading",
    label: "Heading",
    type: "heading",
    icon: studioIcons.text,
    createData: () => baseNode("heading", { level: 2, text: "Add your heading here" }),
  },
  {
    id: "text",
    label: "Text",
    type: "text",
    icon: studioIcons.text,
    createData: () => baseNode("text", { content: "Add your text here..." }),
  },
  {
    id: "button",
    label: "Button",
    type: "button",
    icon: studioIcons.cursorLine,
    createData: () => baseNode("button", { text: "Click me" }),
  },
  {
    id: "image",
    label: "Image",
    type: "image",
    icon: studioIcons.galleryLinear,
    createData: () => baseNode("image", {
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
      alt: "",
    }),
  },
  {
    id: "video",
    label: "Video",
    type: "video",
    icon: studioIcons.video,
    createData: () => baseNode("video", { src: "", poster: "", alt: "" }),
  },
  {
    id: "icon",
    label: "Icon",
    type: "icon",
    icon: studioIcons.star,
    createData: () => baseNode("icon", {
      icon: {
        id: "lucide:star",
        pack: "lucide",
        name: "star",
        source: "iconify",
        version: "2026-06-24-local",
      },
    }),
  },
  {
    id: "icon-list",
    label: "Icon List",
    type: "list",
    icon: studioIcons.checkCircleLinear,
    createData: () => createIconListNode({
      items: ["First item", "Second item", "Third item"],
    }),
  },
  {
    id: "svg",
    label: "SVG",
    type: "svg",
    icon: studioIcons.design,
    createData: () => baseNode("svg", {
      viewBox: "0 0 24 24",
      width: "48",
      height: "48",
    }),
  },
  {
    id: "list",
    label: "List",
    type: "list",
    icon: studioIcons.list,
    createData: () => createListNode({
      ordered: false,
      items: ["First item", "Second item", "Third item"],
    }),
  },
  {
    id: "link",
    label: "Link",
    type: "link",
    icon: studioIcons.linkLine,
    createData: () => baseNode("link", { href: "#", text: "Link text" }),
  },
  {
    id: "code",
    label: "Code",
    type: "code",
    icon: studioIcons.code,
    createData: () => baseNode("code", { content: "// Add your code here" }),
  },
  {
    id: "pagination",
    label: "Pagination",
    type: "pagination",
    icon: studioIcons.list,
    createData: () => createPaginationNode(),
  },
  {
    id: "navigation",
    label: "Navigation",
    type: "navigation",
    icon: studioIcons.menu01,
    createData: () => createNavigationNode(),
  },
];

function readUsageCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0,
      ),
    );
  } catch {
    return {};
  }
}

export function getQuickAddElements(): QuickAddElement[] {
  const usage = readUsageCounts();
  const ranked = QUICK_ADD_PRIMITIVES
    .map((element, order) => ({ element, order, count: usage[element.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, 11)
    .map(({ element }) => element);
  return [QUICK_ADD_CONTAINER, ...ranked];
}

export function resolveQuickAddUsageId(
  type: string,
  data: Partial<BuilderNode>,
): string | null {
  const normalized = type.trim().toLowerCase();
  if (normalized === "list") {
    const label = data.metadata?.label?.trim().toLowerCase();
    return label === "icon list" ? "icon-list" : "list";
  }
  return QUICK_ADD_PRIMITIVES.some((element) => element.id === normalized)
    ? normalized
    : null;
}

export function recordQuickAddElementUsage(id: string): void {
  if (typeof window === "undefined") return;
  const elementExists = QUICK_ADD_PRIMITIVES.some((element) => element.id === id);
  if (!elementExists) return;

  const usage = readUsageCounts();
  usage[id] = (usage[id] ?? 0) + 1;
  try {
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
    window.dispatchEvent(new Event(QUICK_ADD_USAGE_CHANGED_EVENT));
  } catch {
    // Quick-add ranking remains available using the default order when storage is unavailable.
  }
}
