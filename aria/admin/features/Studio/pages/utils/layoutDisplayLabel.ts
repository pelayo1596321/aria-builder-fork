import type { StudioMessageKey } from "@/i18n";

const BUILT_IN_LAYOUT_LABEL_KEYS: Record<string, string> = {
  "full-width": "pages.layoutOption.contentOnly",
  "left-sidebar": "pages.layoutOption.leftSidebar",
  "right-sidebar": "pages.layoutOption.rightSidebar",
  "two-sidebar": "pages.layoutOption.bothSidebars",
};

const BUILT_IN_LAYOUT_ORDER: Record<string, number> = {
  "full-width": 0,
  "left-sidebar": 1,
  "right-sidebar": 2,
  "two-sidebar": 3,
};

export function getLayoutDisplayLabelKey(
  layoutId: string,
): StudioMessageKey | undefined {
  return BUILT_IN_LAYOUT_LABEL_KEYS[layoutId] as StudioMessageKey | undefined;
}

export function sortLayoutsForPageSelector<T extends { id: string }>(
  layouts: readonly T[],
): T[] {
  return layouts
    .map((layout, index) => ({ layout, index }))
    .sort(
      (a, b) =>
        (BUILT_IN_LAYOUT_ORDER[a.layout.id] ?? Number.MAX_SAFE_INTEGER) -
          (BUILT_IN_LAYOUT_ORDER[b.layout.id] ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ layout }) => layout);
}
