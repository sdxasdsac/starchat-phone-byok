// 移植自 ai-virtual-phone-main/components/desktop-shell.tsx（网格几何段，逐字对照）
// 指针→格子换算与图标矩形碰撞检测共用同一份几何，保证两套判定不会各说各话。
export const GRID_COLS = 4;
export const GRID_ROWS = 6;

export type GridGeometry = {
  originX: number;
  originY: number;
  colStep: number;
  rowStep: number;
  colWidth: number;
  rowHeight: number;
};

export function getGridGeometry(gridEl: HTMLElement): GridGeometry {
  const rect = gridEl.getBoundingClientRect();
  const computed = getComputedStyle(gridEl);
  const colWidths = computed.gridTemplateColumns.split(/\s+/).map(parseFloat);
  const colWidth = colWidths[0] || 66;
  const colGap = parseFloat(computed.columnGap) || 20;
  const rowGap = parseFloat(computed.rowGap) || 0;
  /* rect 高度是 border-box（含 padding），网格行轨道只占内容盒。 */
  const padY = (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0);
  const contentWidth = colWidths.length * colWidth + (colWidths.length - 1) * colGap;
  const originX = rect.left + (rect.width - contentWidth) / 2;
  const originY = rect.top + (parseFloat(computed.paddingTop) || 0);
  const totalRowGap = (GRID_ROWS - 1) * rowGap;
  const rowHeight = (rect.height - padY - totalRowGap) / GRID_ROWS;
  return { originX, originY, colStep: colWidth + colGap, rowStep: rowHeight + rowGap, colWidth, rowHeight };
}

/** 找离 (fromRow, fromCol) 最近的空格，返回 1 基坐标。
 *  源项目还带组件占用矩阵参数；本项目组件段未移植，故只按已用格集合判断。 */
export function findNearestFreeCell(
  fromRow: number,
  fromCol: number,
  usedCells: Set<string>,
): { row: number; col: number } | null {
  let bestDist = Infinity;
  let best: { row: number; col: number } | null = null;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
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

/** 屏幕坐标 → 网格格位（0 基）；越界返回 null */
export function pointerToGridCell(
  px: number,
  py: number,
  gridEl: HTMLElement,
): { row: number; col: number } | null {
  const geom = getGridGeometry(gridEl);
  const col = Math.floor((px - geom.originX) / geom.colStep);
  const row = Math.floor((py - geom.originY) / geom.rowStep);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { row, col };
}
