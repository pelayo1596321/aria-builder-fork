import type { InjectionKey, ShallowRef } from "vue";

export interface CanvasQuickGridTools {
  columns: number;
  rows: number;
  applyDimensions: (rows: number, columns: number) => void;
}

export interface CanvasQuickToolsState {
  selectionSizeLabel: string;
  grid: CanvasQuickGridTools | null;
}

export const CANVAS_QUICK_TOOLS_KEY: InjectionKey<
  ShallowRef<CanvasQuickToolsState>
> = Symbol("canvas-quick-tools");

export const CANVAS_GRID_PRESETS = [
  { rows: 1, columns: 1, cells: 1 },
  { rows: 1, columns: 2, cells: 2 },
  { rows: 1, columns: 3, cells: 3 },
  { rows: 1, columns: 4, cells: 4 },
  { rows: 2, columns: 2, cells: 4 },
  { rows: 2, columns: 3, cells: 6 },
  { rows: 3, columns: 2, cells: 6 },
  { rows: 3, columns: 3, cells: 9 },
] as const;

export const CANVAS_GRID_DIMENSIONS = [
  { key: "columns", label: "Columns" },
  { key: "rows", label: "Rows" },
] as const;
