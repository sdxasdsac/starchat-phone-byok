// 移植自 ai-virtual-phone-main/lib/widget-types.ts + widget-storage.ts（组件布局引擎）
// 本轮只移植 2×2 的 clock / calendar 两种组件；其余组件类型待后续轮次。
import { GRID_COLS, GRID_ROWS } from '@/components/phone/float-phone-grid';
import type { IconPosition } from '@/components/phone/float-phone-icons';

export type WidgetType = 'clock' | 'calendar' | 'largeTime' | 'moodPill' | 'photo' | 'loveNote';
export type WidgetSize = '2x2' | '2x4' | '1x4';

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  page: number;
  row: number; // 1 基
  col: number; // 1 基
  config?: Record<string, unknown>;
};

/** How many grid cells a widget size occupies: [rows, cols]（源 WIDGET_SIZE_CELLS） */
export const WIDGET_SIZE_CELLS: Record<WidgetSize, [number, number]> = {
  '2x2': [2, 2],
  '2x4': [2, 4],
  '1x4': [1, 4],
};

export const WIDGET_CATALOG: { type: WidgetType; name: string; desc: string; size: WidgetSize }[] = [
  { type: 'largeTime', name: '极简数字大时钟', desc: '大画幅数字时间与日期文字', size: '2x4' },
  { type: 'moodPill', name: '悬浮心情气泡', desc: '极简浮动文字标签与表情装饰', size: '1x4' },
  { type: 'clock', name: '时钟 + 日期', desc: '大号时间 + 日期星期', size: '2x2' },
  { type: 'calendar', name: '日历', desc: '月视图 + 高亮今天', size: '2x2' },
  { type: 'photo', name: '照片相框', desc: '放一张照片，点击替换', size: '2x2' },
  { type: 'loveNote', name: '情话便签', desc: '随机甜蜜情话', size: '2x2' },
];

/** 源默认组件共 6 个；本轮落地可渲染的 3 个，位置沿用源（page1 大时钟/气泡、page3 日历） */
const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: 'default_widget_large_time', type: 'largeTime', size: '2x4', page: 1, row: 1, col: 1 },
  { id: 'default_widget_mood_pill', type: 'moodPill', size: '1x4', page: 1, row: 3, col: 1 },
  { id: 'default_widget_calendar', type: 'calendar', size: '2x2', page: 3, row: 4, col: 1 },
];

export function createDefaultWidgets(): WidgetInstance[] {
  return DEFAULT_WIDGETS.map((widget) => ({ ...widget }));
}

/** 组件占用的格位矩阵（1 基行列换算成 0 基索引） */
export function buildWidgetOccupancy(widgets: WidgetInstance[], page: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false),
  );
  for (const widget of widgets) {
    if (widget.page !== page) continue;
    const [rows, cols] = WIDGET_SIZE_CELLS[widget.size];
    for (let rowOffset = 0; rowOffset < rows; rowOffset++) {
      for (let colOffset = 0; colOffset < cols; colOffset++) {
        const row = widget.row - 1 + rowOffset;
        const col = widget.col - 1 + colOffset;
        if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
          grid[row][col] = true;
        }
      }
    }
  }
  return grid;
}

/** 只挪和组件重叠的图标，其余原地不动（源 displaceIconsForWidgets） */
export function displaceIconsForWidgets(
  icons: IconPosition[],
  pageWidgets: WidgetInstance[],
  page: number,
): { placed: IconPosition[]; overflow: IconPosition[] } {
  const widgetOcc = buildWidgetOccupancy(pageWidgets, page);
  const placed: IconPosition[] = [];
  const usedCells = new Set<string>();
  const displaced: IconPosition[] = [];

  for (const icon of icons) {
    if (widgetOcc[icon.row - 1]?.[icon.col - 1]) {
      displaced.push(icon);
    } else {
      placed.push(icon);
      usedCells.add(`${icon.row},${icon.col}`);
    }
  }

  const overflow: IconPosition[] = [];
  for (const icon of displaced) {
    const free = findNearestFree(icon.row, icon.col, widgetOcc, usedCells);
    if (free) {
      placed.push({ id: icon.id, row: free.row, col: free.col });
      usedCells.add(`${free.row},${free.col}`);
    } else {
      overflow.push(icon);
    }
  }

  return { placed, overflow };
}

/** 源 findNearestFreeCell（组件占用版） */
export function findNearestFree(
  fromRow: number,
  fromCol: number,
  widgetOcc: boolean[][],
  usedCells: Set<string>,
): { row: number; col: number } | null {
  let bestDist = Infinity;
  let best: { row: number; col: number } | null = null;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (widgetOcc[r][c]) continue;
      const key = `${r + 1},${c + 1}`;
      if (usedCells.has(key)) continue;
      const dist = Math.abs(r + 1 - fromRow) * GRID_COLS + Math.abs(c + 1 - fromCol);
      if (dist < bestDist) {
        bestDist = dist;
        best = { row: r + 1, col: c + 1 };
      }
    }
  }
  return best;
}

export function isValidWidget(raw: unknown): raw is WidgetInstance {
  if (!raw || typeof raw !== 'object') return false;
  const w = raw as Record<string, unknown>;
  if (typeof w.id !== 'string' || typeof w.type !== 'string') return false;
  if (!['clock', 'calendar', 'largeTime', 'moodPill', 'photo', 'loveNote'].includes(w.type)) return false;
  if (!['2x2', '2x4', '1x4'].includes(String(w.size))) return false;
  if (typeof w.page !== 'number' || typeof w.row !== 'number' || typeof w.col !== 'number') return false;
  if (w.row < 1 || w.row > GRID_ROWS || w.col < 1 || w.col > GRID_COLS) return false;
  return true;
}
