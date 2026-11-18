'use client';

// 移植自 ai-virtual-phone-main/components/desktop-shell.tsx（桌面网格 / 翻页手势 / 编辑态拖拽 / Dock 段）
// 轮二～十：网格 / 翻页 / 编辑 / 拖拽 / Dock / 跨页 / 文件夹 / 持久化 / 接入；本轮十一：桌面组件（clock / calendar）。
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { DEFAULT_WALLPAPER_ID, WALLPAPER_EVENT, getWallpaper, readLocalWallpaper } from '@/lib/phone-theme';
import { markIconRemoved, readRemovedIcons, removePluginDesktopMeta, readPluginDesktopMeta } from '@/lib/phone-app-install';
import { THEME_PACK_EVENT, readActiveThemePack, resolveThemePackSkin } from '@/lib/phone-theme-pack';
import { IconGlyph } from '@/components/phone/FloatPhoneIconGlyph';
import {
  GRID_COLS,
  GRID_ROWS,
  getGridGeometry,
  pointerToGridCell,
} from '@/components/phone/float-phone-grid';
import {
  DOCK_DEFAULT,
  ICONS,
  PAGE_1_DEFAULT,
  PAGE_2_DEFAULT,
  PAGE_3_DEFAULT,
  createFolderIconId,
  isFolderIconId,
  type DesktopFolderMap,
  type DesktopIconId,
  type DesktopLayout,
  type IconId,
} from '@/components/phone/float-phone-icons';
import {
  loadDesktopFolders,
  loadDockLayout,
  loadIconLayout,
  loadWidgets,
  saveDesktopFolders,
  saveDockLayout,
  saveIconLayout,
  saveWidgets,
} from '@/components/phone/float-phone-storage';
import { FloatPhoneWidget } from '@/components/phone/FloatPhoneWidgets';
import {
  WIDGET_SIZE_CELLS,
  buildWidgetOccupancy,
  createDefaultWidgets,
  displaceIconsForWidgets,
  findNearestFree,
  type WidgetInstance,
} from '@/components/phone/float-widgets';

const SWIPE_THRESHOLD_RATIO = 0.2;
const SWIPE_MIN_THRESHOLD = 60;
/** 源 lib/desktop-layout-storage.ts：DOCK_MAX = 4 */
const DOCK_MAX = 4;
/** Dock 在源项目里是一个伪页面 key，用来复用同一套拖拽状态机 */
const DOCK_PAGE_KEY = 'dock';
/** 系统级入口不允许从桌面删除：微信是主聊天，应用市场是唯一的重装入口 */
const UNDELETABLE_ICONS = new Set<string>(['wechat', 'appmarket']);

const DEFAULT_PAGES: IconId[][] = [PAGE_1_DEFAULT, PAGE_2_DEFAULT, PAGE_3_DEFAULT];

/** 插件图标：包里没有图标文件 / 旧数据里写死的不存在路径，都退回通用字形，避免破图 */
function PluginIconImage({ id, src, className }: { id: IconId; src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <IconGlyph id={id} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}


/** IconId[] → 显式行列（源项目 layout 即 IconPosition[]，1 基行列） */
function buildInitialLayout(pages: IconId[][]): DesktopLayout {
  const layout: DesktopLayout = {};
  pages.forEach((icons, pageIndex) => {
    layout[`page${pageIndex + 1}`] = icons.slice(0, GRID_ROWS * GRID_COLS).map((id, index) => ({
      id,
      row: Math.floor(index / GRID_COLS) + 1,
      col: (index % GRID_COLS) + 1,
    }));
  });
  return layout;
}

function cloneLayout(layout: DesktopLayout): DesktopLayout {
  const next: DesktopLayout = {};
  for (const key of Object.keys(layout)) next[key] = layout[key].map((ic) => ({ ...ic }));
  return next;
}

/** page12 → 12；用于页面 key 的数值排序 */
function pageNumberOf(key: string): number {
  return Number.parseInt(key.replace(/\D/g, ''), 10) || 1;
}

function sortPageKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => pageNumberOf(a) - pageNumberOf(b));
}

type EditDrag = {
  active: boolean;
  pending: boolean;
  itemType: 'icon' | 'widget';
  /** 图标 id 或组件 id（字符串统一存，用 itemType 区分） */
  itemId: string;
  sourcePage: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  lastTargetKey: string;
  /** 落点（ref 保存，commitDrop 永远读到最新值） */
  targetPage: string | null;
  targetRow: number; // 1 基
  targetCol: number; // 1 基
  /** targetPage === dock 时的插入下标 */
  targetDockIndex: number;
  /** 拖到工作区左右边缘停留后的自动翻页计时器 */
  edgeTimer: number | null;
  /** 与某个图标接触中：先裁决一次「合并 / 换位」，接触期间不改判 */
  contactId: DesktopIconId | null;
  contactIntent: 'merge' | 'swap' | null;
  /** 组件拖拽：指针相对组件左上角落在第几个格子 */
  grabCellRow: number;
  grabCellCol: number;
  /** 悬停足够久后武装成组高亮 */
  mergeTimer: number | null;
  mergeArmed: boolean;
  mergeTargetIconId: DesktopIconId | null;
  mergeTargetPage: string | null;
  /** 从文件夹里拖出时记录来源（成员已从表里预移除） */
  sourceFolderId: string | null;
  element: HTMLElement;
  ghostW: number;
  ghostH: number;
  shellLeft: number;
  shellTop: number;
  initialLayout: DesktopLayout;
  initialDock: IconId[];
  initialFolders: DesktopFolderMap;
  initialWidgets: WidgetInstance[];
};

export function FloatPhoneDesktop({
  pages = DEFAULT_PAGES,
  dock: initialDock = DOCK_DEFAULT,
  onOpen,
}: {
  pages?: IconId[][];
  dock?: IconId[];
  onOpen?: (id: IconId) => void;
}) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<DesktopLayout>(() => buildInitialLayout(pages));
  const [dock, setDock] = useState<IconId[]>(initialDock);
  /** 桌面文件夹：tile 在 layout 里占格子，这张表管名字和成员 */
  const [folders, setFolders] = useState<DesktopFolderMap>({});
  const [widgets, setWidgets] = useState<WidgetInstance[]>(() => createDefaultWidgets());
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderPageIndex, setFolderPageIndex] = useState(0);
  const [mergeTargetId, setMergeTargetId] = useState<DesktopIconId | null>(null);
  const [dragItem, setDragItem] = useState<{ id: string; type: 'icon' | 'widget' } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ page: string; row: number; col: number } | null>(null);
  /** 删除图标后的轻提示（真手机那种 toast） */
  const [desktopHint, setDesktopHint] = useState('');
  const desktopHintTimerRef = useRef<number | null>(null);
  const showDesktopHint = useCallback((message: string) => {
    setDesktopHint(message);
    if (desktopHintTimerRef.current) window.clearTimeout(desktopHintTimerRef.current);
    desktopHintTimerRef.current = window.setTimeout(() => setDesktopHint(''), 1800);
  }, []);

  const currentPageIndexRef = useRef(0);
  const layoutRef = useRef(layout);
  const dockRef = useRef(dock);
  const foldersRef = useRef(folders);
  const widgetsRef = useRef(widgets);
  const folderPressRef = useRef<{
    timer: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const swipeLayerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const dockElRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const gridRefs = useRef<Record<string, HTMLElement | null>>({});
  /** 当前主题包的图标皮肤（iconId → 图片地址），没装主题包时为空 */
  const [packSkins, setPackSkins] = useState<Record<string, string>>({});
  /** 主题包已启用：没皮肤的图标也要跟着换掉奶油底板 */
  const themePackActive = Object.keys(packSkins).length > 0;

  useEffect(() => {
    const sync = () => setPackSkins(readActiveThemePack()?.skins ?? {});
    sync();
    window.addEventListener(THEME_PACK_EVENT, sync);
    return () => window.removeEventListener(THEME_PACK_EVENT, sync);
  }, []);

  // 桌面壁纸：和「素材仓库 / 主题」共用一份设置。用 inline !important 覆盖主题自带的底色，
  // 否则只改 localStorage、桌面看起来「根本没应用」。
  useEffect(() => {
    const applyWallpaper = () => {
      const shell = workspaceRef.current?.closest('.phone-shell') as HTMLElement | null;
      if (!shell) return;
      const id = readLocalWallpaper();
      shell.style.setProperty('background', getWallpaper(id).bg, 'important');
      // 壳内还有一层不透明的 .phone-wallpaper（默认渐变）。选了非默认壁纸时必须把它藏起来，
      // 否则桌面上看到的永远是那层默认渐变，用户会以为「壁纸根本没应用」。
      const overlay = shell.querySelector<HTMLElement>('.phone-wallpaper');
      if (overlay) {
        if (id !== DEFAULT_WALLPAPER_ID) overlay.style.setProperty('display', 'none', 'important');
        else overlay.style.removeProperty('display');
      }
    };
    applyWallpaper();
    window.addEventListener(WALLPAPER_EVENT, applyWallpaper);
    return () => {
      window.removeEventListener(WALLPAPER_EVENT, applyWallpaper);
    };
  }, []);
  const longPressRef = useRef<{
    timer: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const blankTapRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // 长按桌面空白进入编辑（Missy 交互参考：onDesktopPointerDown）
  const blankPressRef = useRef<{
    timer: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const editDragRef = useRef<EditDrag | null>(null);
  const flipRectsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    deltaX: number;
    locked: 'x' | 'y' | null;
    pointerId: number | null;
  }>({ startX: 0, startY: 0, deltaX: 0, locked: null, pointerId: null });

  // 页面数随 layout 增长（右侧越界拖拽会补新页），不再固定为入参 pages 的长度
  const pageKeys = useMemo(() => sortPageKeys(Object.keys(layout)), [layout]);
  const pageCount = pageKeys.length;

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // 首帧用默认布局渲染（保证 SSR/水合一致），挂载后再从本地存储水合。
  useEffect(() => {
    const hydratedFolders = loadDesktopFolders();
    const hydratedWidgets = loadWidgets(createDefaultWidgets());
    const hydratedLayout = loadIconLayout(buildInitialLayout(pages));
    const hydratedDock = loadDockLayout(initialDock);
    // 组件占格：把和组件重叠的图标就近挪开（源 displaceIconsForWidgets）
    const displaced = cloneLayout(hydratedLayout);
    for (const pageKey of sortPageKeys(Object.keys(displaced))) {
      const pageNum = pageNumberOf(pageKey);
      const pageWidgets = hydratedWidgets.filter((w) => w.page === pageNum);
      if (!pageWidgets.length) continue;
      const { placed, overflow } = displaceIconsForWidgets(displaced[pageKey], pageWidgets, pageNum);
      displaced[pageKey] = placed;
      for (const ov of overflow) {
        const nextKey = `page${pageNum + 1}`;
        displaced[nextKey] = displaced[nextKey] ?? [];
        const used = new Set(displaced[nextKey].map((ic) => `${ic.row},${ic.col}`));
        const occ = buildWidgetOccupancy(hydratedWidgets, pageNum + 1);
        const free = findNearestFree(ov.row, ov.col, occ, used);
        if (free) displaced[nextKey].push({ id: ov.id, row: free.row, col: free.col });
      }
    }
    // 老布局缺少微信 / QQ / 游戏入口时自动补回（这三个是本项目的核心入口，用户手动删掉的不再补）
    const removedByUser = new Set(readRemovedIcons());
    const mustHave: IconId[] = ['wechat', 'qq'].filter(
      (id) => !removedByUser.has(String(id)),
    ) as IconId[];
    const presentIds = new Set<string>();
    for (const page of Object.values(displaced)) for (const ic of page) presentIds.add(ic.id);
    for (const folder of Object.values(hydratedFolders)) for (const id of folder.icons) presentIds.add(id);
    for (const id of mustHave) {
      if (presentIds.has(id)) continue;
      let pageKey = 'page1';
      let done = false;
      for (let guard = 0; guard < 20 && !done; guard += 1) {
        const pageNum = pageNumberOf(pageKey);
        const occ = buildWidgetOccupancy(hydratedWidgets, pageNum);
        const used = new Set((displaced[pageKey] ?? []).map((ic) => `${ic.row},${ic.col}`));
        for (let row = 1; row <= GRID_ROWS && !done; row += 1) {
          for (let col = 1; col <= GRID_COLS && !done; col += 1) {
            if (used.has(`${row},${col}`) || occ[row - 1]?.[col - 1]) continue;
            displaced[pageKey] = displaced[pageKey] ?? [];
            displaced[pageKey].push({ id, row, col });
            done = true;
          }
        }
        if (!done) pageKey = `page${pageNum + 1}`;
      }
    }
    // dock 与页面/文件夹互斥：一个图标只能存在于一处
    const placed = new Set<string>();
    for (const page of Object.values(displaced)) {
      for (const ic of page) placed.add(ic.id);
    }
    for (const folder of Object.values(hydratedFolders)) {
      for (const id of folder.icons) placed.add(id);
    }
    setFolders(hydratedFolders);
    setLayout(displaced);
    setWidgets(hydratedWidgets);
    setDock(hydratedDock.filter((id) => !placed.has(id)));
    // 只在挂载时水合一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSwipePageWidth = useCallback(() => {
    return swipeLayerRef.current?.getBoundingClientRect().width || 390;
  }, []);

  // 手指位移只写 CSS 变量，不触发 re-render（与源项目一致）
  const setSwipeDrag = useCallback((px: number) => {
    swipeLayerRef.current?.style.setProperty('--swipe-drag', `${px}px`);
  }, []);

  const cancelLongPress = useCallback(() => {
    const lp = longPressRef.current;
    if (lp?.timer) window.clearTimeout(lp.timer);
    longPressRef.current = null;
  }, []);

  const cancelBlankPress = useCallback(() => {
    const bp = blankPressRef.current;
    if (bp?.timer) window.clearTimeout(bp.timer);
    blankPressRef.current = null;
  }, []);

  // ── 编辑态拖拽 ──────────────────────────────────────────────

  const updateGhostPos = useCallback((x: number, y: number) => {
    const drag = editDragRef.current;
    if (!drag || !ghostRef.current) return;
    ghostRef.current.style.transform = `translate3d(${x - drag.offsetX - drag.shellLeft}px, ${y - drag.offsetY - drag.shellTop}px, 0)`;
  }, []);

  const startDragPending = useCallback(
    (
      pointerId: number,
      clientX: number,
      clientY: number,
      itemType: 'icon' | 'widget',
      itemId: string,
      page: string,
      element: HTMLElement,
    ) => {
      const rect = element.getBoundingClientRect();
      // 组件：记录指针相对左上角落在第几个格子（源 startDragPending 同款换算）
      let grabCellRow = 0;
      let grabCellCol = 0;
      if (itemType === 'widget') {
        const gridEl = gridRefs.current[page];
        if (gridEl) {
          const cs = getComputedStyle(gridEl);
          const colW = parseFloat(cs.gridTemplateColumns.split(/\s+/)[0] || '66');
          const colGap = parseFloat(cs.columnGap) || 20;
          const rowGap = parseFloat(cs.rowGap) || 0;
          const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
          const rowH =
            (gridEl.getBoundingClientRect().height - padY - (GRID_ROWS - 1) * rowGap) / GRID_ROWS;
          grabCellCol = Math.floor((clientX - rect.left) / (colW + colGap));
          grabCellRow = Math.floor((clientY - rect.top) / (rowH + rowGap));
        }
      }
      editDragRef.current = {
        active: false,
        pending: true,
        itemType,
        itemId,
        sourcePage: page,
        pointerId,
        startX: clientX,
        startY: clientY,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        lastTargetKey: '',
        targetPage: null,
        targetRow: 0,
        targetCol: 0,
        targetDockIndex: 0,
        edgeTimer: null,
        contactId: null,
        contactIntent: null,
        grabCellRow,
        grabCellCol,
        mergeTimer: null,
        mergeArmed: false,
        mergeTargetIconId: null,
        mergeTargetPage: null,
        sourceFolderId: null,
        element,
        ghostW: rect.width,
        ghostH: rect.height,
        shellLeft: 0,
        shellTop: 0,
        initialLayout: layoutRef.current,
        initialDock: dockRef.current,
        initialFolders: foldersRef.current,
        initialWidgets: widgetsRef.current,
      };
      // Kill swipe tracking for this pointer
      swipeRef.current.pointerId = null;
    },
    [],
  );

  const activateDragAt = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const drag = editDragRef.current;
      if (!drag) return;
      drag.active = true;
      drag.pending = false;
      // Clone element for ghost
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.innerHTML = '';
        const clone = drag.element.cloneNode(true) as HTMLElement;
        clone.style.margin = '0';
        clone.style.gridRow = '';
        clone.style.gridColumn = '';
        // Set explicit size — the clone loses .icon-grid CSS variable context
        clone.style.width = `${drag.ghostW}px`;
        clone.style.height = `${drag.ghostH}px`;
        clone.style.minHeight = '';
        clone.style.boxSizing = 'border-box';
        // 拿起手感：克隆体轻微放大 + 投影
        clone.style.transition = 'transform 0.16s ease, filter 0.16s ease';
        ghost.appendChild(clone);
        requestAnimationFrame(() => {
          clone.style.transform = 'scale(1.06)';
          clone.style.filter = 'drop-shadow(0 14px 22px rgba(0,0,0,0.32))';
        });
        ghost.style.display = 'block';
        ghost.style.width = `${drag.ghostW}px`;
        ghost.style.height = `${drag.ghostH}px`;
      }
      const shellRect = workspaceRef.current?.closest('.phone-shell')?.getBoundingClientRect();
      drag.shellLeft = shellRect?.left ?? 0;
      drag.shellTop = shellRect?.top ?? 0;
      setDragItem({ id: drag.itemId, type: drag.itemType });
      try {
        workspaceRef.current?.setPointerCapture(pointerId);
      } catch {
        /* pointer 可能已抬起 */
      }
      updateGhostPos(clientX, clientY);
    },
    [updateGhostPos],
  );

  /** 指针是否落在（略微外扩的）Dock 底板上 */
  const pointerOverDock = useCallback((x: number, y: number) => {
    const el = dockElRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 24 && y <= r.bottom + 48;
  }, []);

  /** 由指针 x 换算 Dock 插入下标（排除正在拖的那一项） */
  const dockDropIndexFromPointer = useCallback((x: number) => {
    const el = dockElRef.current;
    if (!el) return 0;
    const items = Array.from(el.querySelectorAll<HTMLElement>('.dock-item:not(.dragging)'));
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) return i;
    }
    return items.length;
  }, []);

  /** 落到 Dock 的实时预览：按插入下标重排 dock；页面图标被拖入时从原页摘掉 */
  const simulateDockReflow = useCallback((drag: EditDrag, index: number) => {
    const iconId = drag.itemId as DesktopIconId;
    // 文件夹 tile 不允许进 dock（上游已按无目标处理，这里再兜一层）
    const dockIconId: IconId | null = isFolderIconId(iconId) ? null : iconId;
    const nextDock = drag.initialDock.filter((id) => id !== iconId);
    const clamped = Math.max(0, Math.min(index, nextDock.length));
    if (dockIconId) nextDock.splice(clamped, 0, dockIconId);
    setDock(nextDock);
    if (drag.sourcePage === DOCK_PAGE_KEY) {
      // Reordering within the dock — pages untouched.
      setLayout(drag.initialLayout);
    } else {
      // A page icon is entering the dock — drop it from its page.
      const next = cloneLayout(drag.initialLayout);
      const src = drag.sourcePage;
      next[src] = next[src] ?? [];
      next[src] = next[src].filter((ic) => ic.id !== iconId);
      setLayout(next);
    }
  }, []);

  /** 同页让位预览：目标格被占 → 双方交换；空格 → 直接落位（源 simulateDragReflow 同页分支） */
  const simulateDragReflow = useCallback(
    (drag: EditDrag, tPage: string, tRow: number, tCol: number) => {
      if (drag.itemType !== 'icon') return;
      const iconId = drag.itemId as DesktopIconId;
      const next = cloneLayout(drag.initialLayout);
      // 边缘切换可能在拖拽期间新建了页面（初始快照里没有该 key）
      next[tPage] = next[tPage] ?? [];

      const fromDock = drag.sourcePage === DOCK_PAGE_KEY;
      // 从文件夹拖出的图标不在任何页面上，和「从 dock 进入页面」走同一条外来路径
      const fromOutside = fromDock || drag.sourceFolderId !== null;
      // 组件占格：图标不能落在被组件占据的格子上
      const widgetOcc = buildWidgetOccupancy(widgetsRef.current, pageNumberOf(tPage));

      if (fromOutside) {
        // 从 Dock/文件夹拖出：落点被占则就近找空格
        setDock(fromDock ? drag.initialDock.filter((id) => id !== iconId) : drag.initialDock);
        const tgtArr = next[tPage].filter((ic) => ic.id !== iconId);
        const occupant = tgtArr.find((ic) => ic.row === tRow && ic.col === tCol);
        if (occupant || widgetOcc[tRow - 1]?.[tCol - 1]) {
          const used = new Set(tgtArr.map((ic) => `${ic.row},${ic.col}`));
          const free = findNearestFree(tRow, tCol, widgetOcc, used);
          if (!free) return;
          next[tPage] = [...tgtArr, { id: iconId, row: free.row, col: free.col }];
        } else {
          next[tPage] = [...tgtArr, { id: iconId, row: tRow, col: tCol }];
        }
        setLayout(next);
        return;
      }

      setDock(drag.initialDock); // undo any prior dock preview
      if (widgetOcc[tRow - 1]?.[tCol - 1]) return; // 组件格不可作为落点
      const srcArr = next[tPage].filter((ic) => ic.id !== iconId);
      const occupant = srcArr.find((ic) => ic.row === tRow && ic.col === tCol);
      const draggedOld = (drag.initialLayout[tPage] ?? []).find((ic) => ic.id === iconId);
      if (occupant && draggedOld) {
        next[tPage] = srcArr.map((ic) =>
          ic.id === occupant.id ? { ...ic, row: draggedOld.row, col: draggedOld.col } : ic,
        );
        next[tPage].push({ id: iconId, row: tRow, col: tCol });
      } else {
        next[tPage] = [...srcArr, { id: iconId, row: tRow, col: tCol }];
      }
      setLayout(next);
    },
    [],
  );

  /** 取消「成组」意图：停表 + 熄灭高亮 + 解除武装 */
  const clearMergeIntent = useCallback((drag: EditDrag) => {
    if (drag.mergeTimer) {
      window.clearTimeout(drag.mergeTimer);
      drag.mergeTimer = null;
    }
    if (drag.mergeTargetIconId) setMergeTargetId(null);
    drag.mergeArmed = false;
    drag.mergeTargetIconId = null;
    drag.mergeTargetPage = null;
  }, []);

  /** 组件让位预览：目标格被占则把挡路的组件递归顶开，图标再避开组件（源 3041-3130） */
  const simulateWidgetReflow = useCallback(
    (drag: EditDrag, tPage: string, tRow: number, tCol: number) => {
      const draggedWidget = drag.initialWidgets.find((w) => w.id === drag.itemId);
      if (!draggedWidget) return;
      const targetPageNum = pageNumberOf(tPage);
      let tentativeWidgets = [...drag.initialWidgets];

      const placeWidgetWithBump = (
        widgetToPlace: WidgetInstance,
        targetPage: number,
        row: number,
        col: number,
        depth: number,
      ): boolean => {
        if (depth > 6) return false;
        const [wRows, wCols] = WIDGET_SIZE_CELLS[widgetToPlace.size];

        const overlappingWidgets = tentativeWidgets.filter((w) => {
          if (w.id === widgetToPlace.id || w.page !== targetPage) return false;
          const [oRows, oCols] = WIDGET_SIZE_CELLS[w.size];
          const oX = Math.max(0, Math.min(col + wCols, w.col + oCols) - Math.max(col, w.col));
          const oY = Math.max(0, Math.min(row + wRows, w.row + oRows) - Math.max(row, w.row));
          return oX > 0 && oY > 0;
        });

        tentativeWidgets = tentativeWidgets.map((w) =>
          w.id === widgetToPlace.id ? { ...w, page: targetPage, row, col } : w,
        );

        for (const displaced of overlappingWidgets) {
          const [dRows, dCols] = WIDGET_SIZE_CELLS[displaced.size];

          const attemptInsert = (pageNum: number): boolean => {
            const occ = buildWidgetOccupancy(
              tentativeWidgets.filter((w) => w.page === pageNum && w.id !== displaced.id),
              pageNum,
            );
            const startRow = pageNum === targetPage ? displaced.row : 1;
            for (let r = startRow; r <= GRID_ROWS - dRows + 1; r++) {
              for (let c = 1; c <= GRID_COLS - dCols + 1; c++) {
                let free = true;
                for (let dr = 0; dr < dRows; dr++) {
                  for (let dc = 0; dc < dCols; dc++) {
                    if (occ[r - 1 + dr][c - 1 + dc]) free = false;
                  }
                }
                if (free && placeWidgetWithBump(displaced, pageNum, r, c, depth + 1)) return true;
              }
            }
            return false;
          };

          const maxPage = Math.max(2, targetPage, ...drag.initialWidgets.map((w) => w.page));
          const fallbackPages = Array.from({ length: maxPage + 1 }, (_, index) => index + 1).filter(
            (page) => page !== targetPage,
          );
          let inserted = attemptInsert(targetPage);
          for (const page of fallbackPages) {
            if (inserted) break;
            inserted = attemptInsert(page);
          }
          if (!inserted) return false;
        }
        return true;
      };

      const success = placeWidgetWithBump(draggedWidget, targetPageNum, tRow, tCol, 0);
      if (!success) return;

      const newLayout = cloneLayout(drag.initialLayout);
      newLayout[tPage] = newLayout[tPage] ?? [];
      for (const pageKey of sortPageKeys(Object.keys(newLayout))) {
        const pn = pageNumberOf(pageKey);
        const newPW = tentativeWidgets.filter((w) => w.page === pn);
        const { placed, overflow } = displaceIconsForWidgets(newLayout[pageKey], newPW, pn);
        newLayout[pageKey] = placed;
        for (const ov of overflow) {
          const nextKey = `page${pn + 1}`;
          newLayout[nextKey] = newLayout[nextKey] ?? [];
          const used = new Set(newLayout[nextKey].map((ic) => `${ic.row},${ic.col}`));
          const occ = buildWidgetOccupancy(tentativeWidgets, pn + 1);
          const free = findNearestFree(ov.row, ov.col, occ, used);
          if (free) newLayout[nextKey].push({ id: ov.id, row: free.row, col: free.col });
        }
      }
      setWidgets(tentativeWidgets);
      setLayout(newLayout);
    },
    [],
  );

  /** 接触结束（矩形完全分开/离开网格/进 dock）：重置裁决，下次相交重新算 */
  const clearContact = useCallback(
    (drag: EditDrag) => {
      drag.contactId = null;
      drag.contactIntent = null;
      clearMergeIntent(drag);
    },
    [clearMergeIntent],
  );

  const updateDropTargetFromPointer = useCallback(
    (x: number, y: number) => {
      const drag = editDragRef.current;
      if (!drag) return;

      // ── Dock drop zone（图标 only；文件夹 tile / 组件一律不许进 dock）──
      if (drag.itemType === 'icon' && pointerOverDock(x, y)) {
        const fromDock = drag.sourcePage === DOCK_PAGE_KEY;
        const baseLen = drag.initialDock.filter((id) => id !== drag.itemId).length;
        // Dock full and the icon comes from a page → not allowed. Behave as no-target.
        if ((!fromDock && baseLen >= DOCK_MAX) || isFolderIconId(drag.itemId)) {
          if (drag.targetPage !== null) {
            setLayout(drag.initialLayout);
            setDock(drag.initialDock);
          }
          drag.targetPage = null;
          drag.lastTargetKey = '';
          setDropTarget(null);
          return;
        }
        clearContact(drag);
        const index = Math.min(dockDropIndexFromPointer(x), baseLen);
        const key = `dock:${index}`;
        if (key === drag.lastTargetKey) return;
        drag.lastTargetKey = key;
        drag.targetPage = DOCK_PAGE_KEY;
        drag.targetDockIndex = index;
        setDropTarget(null);
        simulateDockReflow(drag, index);
        return;
      }

      const pageIdx = currentPageIndexRef.current;
      const pageKey = pageKeys[Math.min(pageIdx, pageKeys.length - 1)] ?? 'page1';
      const gridEl = gridRefs.current[pageKey];
      if (!gridEl) return;

      // ── 组件落点：指针格 − 抓取偏移 = 组件左上角格（源 2929-2955）──
      if (drag.itemType === 'widget') {
        const cell = pointerToGridCell(x, y, gridEl);
        if (!cell) {
          if (drag.targetPage !== null) {
            setWidgets(drag.initialWidgets);
            setLayout(drag.initialLayout);
          }
          drag.targetPage = null;
          drag.lastTargetKey = '';
          setDropTarget(null);
          return;
        }
        const widget = drag.initialWidgets.find((w) => w.id === drag.itemId);
        if (!widget) return;
        const [wRows, wCols] = WIDGET_SIZE_CELLS[widget.size];
        const topRow = cell.row - drag.grabCellRow;
        const topCol = cell.col - drag.grabCellCol;
        // 越界（组件必须完整落在网格内）→ 无目标
        if (topRow < 0 || topCol < 0 || topRow + wRows > GRID_ROWS || topCol + wCols > GRID_COLS) {
          return;
        }
        const key = `${pageKey}:${topRow}:${topCol}`;
        if (key === drag.lastTargetKey) return;
        drag.lastTargetKey = key;
        drag.targetPage = pageKey;
        drag.targetRow = topRow + 1;
        drag.targetCol = topCol + 1;
        setDropTarget({ page: pageKey, row: topRow + 1, col: topCol + 1 });
        simulateWidgetReflow(drag, pageKey, topRow + 1, topCol + 1);
        return;
      }

      // ── 矩形碰撞裁决（iOS 手感）──
      // 悬浮图标矩形 vs 目标图标矩形（位置取拖起时的原始布局）。两矩形从
      // 分开变为相交的那一刻裁决一次：任一边重叠过半 = 合并（目标原地不动，
      // ~0.2s 后亮圈武装，松手成组）；两边都不过半 = 换位（目标让位）。
      // 相交期间不改判；文件夹 tile 只换位不合并（不嵌套）。
      const geom = getGridGeometry(gridEl);
      const dragBoxW = Math.min(58, drag.ghostW);
      const dragLeft = x - drag.offsetX + (drag.ghostW - dragBoxW) / 2;
      const dragTop = y - drag.offsetY;
      const targetBoxW = Math.min(58, geom.colWidth);
      let best: { id: DesktopIconId; row: number; col: number; ox: number; oy: number; area: number } | null = null;
      for (const ic of drag.initialLayout[pageKey] ?? []) {
        if (ic.id === drag.itemId) continue;
        const tLeft = geom.originX + (ic.col - 1) * geom.colStep + (geom.colWidth - targetBoxW) / 2;
        const tTop = geom.originY + (ic.row - 1) * geom.rowStep;
        const ox = Math.min(dragLeft + dragBoxW, tLeft + targetBoxW) - Math.max(dragLeft, tLeft);
        const oy = Math.min(dragTop + dragBoxW, tTop + targetBoxW) - Math.max(dragTop, tTop);
        if (ox <= 0 || oy <= 0) continue;
        const area = ox * oy;
        if (!best || area > best.area) best = { id: ic.id, row: ic.row, col: ic.col, ox, oy, area };
      }

      if (best && best.id === drag.contactId) {
        // 同一次接触持续中：维持裁决。合并=冻结中无事可做；换位=目标已锁定。
        return;
      }
      if (best) {
        // 新接触：只在此刻裁决一次
        clearMergeIntent(drag);
        drag.contactId = best.id;
        // 合并阈值：接触瞬间任一边重叠超过边长的 60%
        const mergeEdge = Math.min(dragBoxW, targetBoxW) * 0.6;
        const merge = !isFolderIconId(drag.itemId) && (best.ox > mergeEdge || best.oy > mergeEdge);
        drag.contactIntent = merge ? 'merge' : 'swap';
        if (merge) {
          const targetId = best.id;
          drag.mergeTargetIconId = targetId;
          drag.mergeTargetPage = pageKey;
          // 冻结让位预览：合并目标原地不动
          setLayout(drag.initialLayout);
          setDock(drag.initialDock);
          drag.targetPage = null;
          drag.lastTargetKey = `merge:${pageKey}:${targetId}`;
          setDropTarget(null);
          drag.mergeTimer = window.setTimeout(() => {
            const live = editDragRef.current;
            if (live !== drag || !drag.active || drag.mergeTargetIconId !== targetId) return;
            drag.mergeTimer = null;
            drag.mergeArmed = true;
            setMergeTargetId(targetId);
            try {
              navigator.vibrate?.(10);
            } catch {
              /* 不支持就算了 */
            }
          }, 180);
          return;
        }
        // 换位：目标锁定为对方的格子
        const key = `${pageKey}:${best.row}:${best.col}`;
        if (key === drag.lastTargetKey) return;
        drag.lastTargetKey = key;
        drag.targetPage = pageKey;
        drag.targetRow = best.row;
        drag.targetCol = best.col;
        setDropTarget({ page: pageKey, row: best.row, col: best.col });
        simulateDragReflow(drag, pageKey, best.row, best.col);
        return;
      }

      // ── 无接触：空格/缝隙落点，用悬浮图标盒中心所在格 ──
      if (drag.contactId) clearContact(drag);
      const probeX = x - drag.offsetX + drag.ghostW / 2;
      const probeY = y - drag.offsetY + dragBoxW / 2;
      const cell = pointerToGridCell(probeX, probeY, gridEl);
      if (!cell) {
        if (drag.targetPage !== null) {
          setLayout(drag.initialLayout);
          setDock(drag.initialDock);
        }
        drag.targetPage = null;
        drag.lastTargetKey = '';
        setDropTarget(null);
        return;
      }
      const key = `${pageKey}:${cell.row}:${cell.col}`;
      if (key === drag.lastTargetKey) return;
      // 组件格不可作为落点
      const widgetOcc = buildWidgetOccupancy(widgetsRef.current, pageNumberOf(pageKey));
      if (widgetOcc[cell.row]?.[cell.col]) {
        if (drag.targetPage !== null) {
          setLayout(drag.initialLayout);
          setDock(drag.initialDock);
        }
        drag.targetPage = null;
        drag.lastTargetKey = key;
        setDropTarget(null);
        return;
      }
      drag.lastTargetKey = key;
      drag.targetPage = pageKey;
      drag.targetRow = cell.row + 1;
      drag.targetCol = cell.col + 1;
      setDropTarget({ page: pageKey, row: cell.row + 1, col: cell.col + 1 });
      simulateDragReflow(drag, pageKey, cell.row + 1, cell.col + 1);
    },
    [
      pageKeys,
      pointerOverDock,
      dockDropIndexFromPointer,
      simulateDockReflow,
      simulateDragReflow,
      simulateWidgetReflow,
      clearContact,
      clearMergeIntent,
    ],
  );

  /** 拖到工作区左右 36px 边缘停留 350ms → 自动翻页；右侧越界时自动补一页 */
  const checkEdgeSwitch = useCallback(
    (x: number) => {
      const drag = editDragRef.current;
      const ws = workspaceRef.current;
      if (!drag || !ws) return;
      const rect = ws.getBoundingClientRect();
      const EDGE = 36;
      const pageIdx = currentPageIndexRef.current;
      const lastPageIndex = Math.max(0, pageKeys.length - 1);
      const nearLeft = x - rect.left < EDGE;
      const nearRight = rect.right - x < EDGE;
      const canSwitchLeft = nearLeft && pageIdx > 0;
      const canSwitchRight = nearRight;

      if (canSwitchLeft && !drag.edgeTimer) {
        drag.edgeTimer = window.setTimeout(() => {
          setCurrentPageIndex(Math.max(0, pageIdx - 1));
          drag.edgeTimer = null;
          drag.lastTargetKey = '';
        }, 350);
      } else if (canSwitchRight && !drag.edgeTimer) {
        drag.edgeTimer = window.setTimeout(() => {
          if (pageIdx >= lastPageIndex) {
            const nextPageKey = `page${pageIdx + 2}`;
            setLayout((prev) => {
              const next = cloneLayout(prev);
              if (!next[nextPageKey]) next[nextPageKey] = [];
              return next;
            });
          }
          setCurrentPageIndex(pageIdx + 1);
          drag.edgeTimer = null;
          drag.lastTargetKey = '';
        }, 350);
      } else if (!canSwitchLeft && !canSwitchRight && drag.edgeTimer) {
        window.clearTimeout(drag.edgeTimer);
        drag.edgeTimer = null;
      }
    },
    [pageKeys],
  );

  /** 文件夹只剩 ≤1 个成员就地解散：剩下的图标顶回 tile 的格子 */
  const dissolveFolderIfTiny = useCallback((folderId: string) => {
    const folder = foldersRef.current[folderId];
    if (!folder || folder.icons.length > 1) return;
    const remaining = folder.icons[0] ?? null;
    const next = cloneLayout(layoutRef.current);
    let replaced = false;
    for (const pageKey of sortPageKeys(Object.keys(next))) {
      const tile = (next[pageKey] ?? []).find((ic) => ic.id === folderId);
      if (!tile) continue;
      next[pageKey] = next[pageKey].filter((ic) => ic.id !== folderId);
      if (remaining) next[pageKey] = [...next[pageKey], { id: remaining, row: tile.row, col: tile.col }];
      replaced = true;
      break;
    }
    const nextFolders = { ...foldersRef.current };
    delete nextFolders[folderId];
    setFolders(nextFolders);
    if (replaced) setLayout(next);
    setOpenFolderId((current) => (current === folderId ? null : current));
    saveDesktopFolders(nextFolders);
    if (replaced) saveIconLayout(next);
  }, []);

  /**
   * 松手在「合并目标」上：拖着的图标进组。目标是普通图标就俩人组新文件夹
   * （占目标的格子），目标已是文件夹就并入。基于 initial 状态重建。
   * 返回 false 表示目标已失效，按取消处理。
   */
  const commitMergeDrop = useCallback((drag: EditDrag): boolean => {
    if (drag.itemType !== 'icon') return false;
    const draggedId = drag.itemId as DesktopIconId;
    const targetId = drag.mergeTargetIconId;
    const tPage = drag.mergeTargetPage;
    if (!targetId || !tPage) return false;
    const nextLayout = cloneLayout(drag.initialLayout);
    let nextDock = drag.initialDock;

    // 把拖着的图标从来源摘掉（文件夹来源在拖起时已从表里预移除）
    if (drag.sourcePage === DOCK_PAGE_KEY) {
      nextDock = nextDock.filter((id) => id !== draggedId);
    } else if (!drag.sourceFolderId) {
      const src = drag.sourcePage;
      nextLayout[src] = (nextLayout[src] ?? []).filter((ic) => ic.id !== draggedId);
    }

    const nextFolders: DesktopFolderMap = { ...foldersRef.current };
    const targetTile = (nextLayout[tPage] ?? []).find((ic) => ic.id === targetId);
    if (!targetTile || draggedId === targetId) return false;

    if (isFolderIconId(targetId)) {
      const folder = nextFolders[targetId];
      if (!folder) return false;
      if (!folder.icons.includes(draggedId)) {
        nextFolders[targetId] = { ...folder, icons: [...folder.icons, draggedId] };
      }
    } else {
      const folderId = createFolderIconId();
      nextFolders[folderId] = { name: '文件夹', icons: [targetId, draggedId] };
      nextLayout[tPage] = (nextLayout[tPage] ?? []).map((ic) =>
        ic.id === targetId ? { ...ic, id: folderId } : ic,
      );
    }

    // 来源文件夹被掏得只剩 ≤1 人 → 就地解散
    const srcFolderId = drag.sourceFolderId;
    if (srcFolderId && nextFolders[srcFolderId] && nextFolders[srcFolderId].icons.length <= 1) {
      const remaining = nextFolders[srcFolderId].icons[0] ?? null;
      delete nextFolders[srcFolderId];
      for (const pageKey of sortPageKeys(Object.keys(nextLayout))) {
        const tile = (nextLayout[pageKey] ?? []).find((ic) => ic.id === srcFolderId);
        if (!tile) continue;
        nextLayout[pageKey] = nextLayout[pageKey].filter((ic) => ic.id !== srcFolderId);
        if (remaining) {
          nextLayout[pageKey] = [...nextLayout[pageKey], { id: remaining, row: tile.row, col: tile.col }];
        }
        break;
      }
    }

    setLayout(nextLayout);
    setDock(nextDock);
    setFolders(nextFolders);
    saveIconLayout(nextLayout);
    saveDockLayout(nextDock);
    saveDesktopFolders(nextFolders);
    return true;
  }, []);

  const commitDrop = useCallback(() => {
    const drag = editDragRef.current;
    if (!drag) return;

    // 成组必须已「武装」（圈亮了才算数）：快速滑过图标时松手只弹回，不误进组
    const isMergeDrop = Boolean(
      drag.itemType === 'icon' &&
        drag.active &&
        drag.mergeArmed &&
        drag.mergeTargetIconId &&
        drag.mergeTargetPage,
    );
    const hasTarget = drag.active && (drag.targetPage || isMergeDrop);
    let mergeCommitted = false;
    if (isMergeDrop) {
      try {
        mergeCommitted = commitMergeDrop(drag);
      } catch {
        mergeCommitted = false;
      }
    }

    if (mergeCommitted) {
      // 已合并入组 — 状态在 commitMergeDrop 里整体写好
    } else if (!hasTarget || isMergeDrop) {
      // 无落点，或合并目标中途失效 → 全部还原（含文件夹成员 / 组件）
      setLayout(drag.initialLayout);
      setDock(drag.initialDock);
      setFolders(drag.initialFolders);
      setWidgets(drag.initialWidgets);
    } else if (drag.sourceFolderId) {
      // 从文件夹拖出成功落位：来源文件夹可能只剩一个人，解散
      const srcFolderId = drag.sourceFolderId;
      window.setTimeout(() => dissolveFolderIfTiny(srcFolderId), 0);
    }

    // 组件成功落位 → 立即落盘
    if (drag.itemType === 'widget' && hasTarget) {
      window.setTimeout(() => saveWidgets(widgetsRef.current), 0);
    }

    // Cleanup drag
    if (drag.mergeTimer) window.clearTimeout(drag.mergeTimer);
    if (drag.mergeTargetIconId) setMergeTargetId(null);
    if (drag.edgeTimer) window.clearTimeout(drag.edgeTimer);
    const wasActive = drag.active;
    const shellLeft = drag.shellLeft;
    const shellTop = drag.shellTop;
    const flipKey = `${drag.itemType}:${drag.itemId}`;
    editDragRef.current = null;
    setDropTarget(null);

    const ghost = ghostRef.current;
    const finalize = () => {
      if (ghost) {
        ghost.style.transition = '';
        ghost.style.display = 'none';
        const inner = ghost.firstElementChild as HTMLElement | null;
        if (inner) {
          inner.style.transform = '';
          inner.style.filter = '';
        }
      }
      setDragItem(null);
    };
    if (!wasActive || !ghost || ghost.style.display === 'none') {
      finalize();
      return;
    }
    // 落位动画：ghost 平滑飞到最终格位（布局已实时写入/恢复，元素就位）
    requestAnimationFrame(() => {
      let el: HTMLElement | null = null;
      try {
        el = document.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(flipKey)}"]`);
      } catch {
        /* ignore */
      }
      if (!el) {
        finalize();
        return;
      }
      const r = el.getBoundingClientRect();
      const inner = ghost.firstElementChild as HTMLElement | null;
      if (inner) {
        inner.style.transform = 'scale(1)';
        inner.style.filter = 'none';
      }
      ghost.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      ghost.style.transform = `translate3d(${r.left - shellLeft}px, ${r.top - shellTop}px, 0)`;
      window.setTimeout(finalize, 210);
    });
  }, []);

  const exitEditMode = useCallback(() => {
    cancelBlankPress();
    // 退出编辑时落盘：布局 / Dock / 文件夹 / 组件（与源 exitEditMode 一致）
    saveIconLayout(layoutRef.current);
    saveDockLayout(dockRef.current);
    saveDesktopFolders(foldersRef.current);
    saveWidgets(widgetsRef.current);
    setEditMode(false);
    setDragItem(null);
    setDropTarget(null);
    setMergeTargetId(null);
    if (editDragRef.current?.edgeTimer) window.clearTimeout(editDragRef.current.edgeTimer);
    if (editDragRef.current?.mergeTimer) window.clearTimeout(editDragRef.current.mergeTimer);
    editDragRef.current = null;
    blankTapRef.current = null;
    if (ghostRef.current) ghostRef.current.style.display = 'none';
    setSwipeDrag(0);
  }, [setSwipeDrag, cancelBlankPress]);

  const handleItemPointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLElement>,
      itemType: 'icon' | 'widget',
      id: string,
      page: string,
    ) => {
      // Prevent native context menu on long-press
      e.preventDefault();
      let element = e.currentTarget as HTMLElement;
      // 组件以 .widget-glass 为拖拽实体（源 handleItemPointerDown 同款）
      if (itemType === 'widget') {
        const inner = element.querySelector('.widget-glass') as HTMLElement | null;
        if (inner) element = inner;
      }
      // Dock 在 .phone-workspace 之外，先捕获到按钮本身，移动才能送达（激活后转交 workspace）
      if (page === DOCK_PAGE_KEY) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (editMode) {
        // Start drag immediately in edit mode
        e.stopPropagation();
        startDragPending(e.pointerId, e.clientX, e.clientY, itemType, id, page, element);
        return;
      }
      // Start long-press timer (don't stopPropagation — swipe should still work)
      cancelLongPress();
      longPressRef.current = {
        timer: window.setTimeout(() => {
          longPressRef.current = null;
          setEditMode(true);
          try {
            navigator.vibrate?.(30);
          } catch {
            /* 不支持就算了 */
          }
          startDragPending(e.pointerId, e.clientX, e.clientY, itemType, id, page, element);
        }, 500),
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
      };
    },
    [editMode, cancelLongPress, startDragPending],
  );

  // ── 文件夹面板：长按成员图标 → 拖出到桌面 ────────────────────

  const cancelFolderIconPress = useCallback(() => {
    const press = folderPressRef.current;
    if (press?.timer) window.clearTimeout(press.timer);
    folderPressRef.current = null;
  }, []);

  /**
   * 面板成员被拖起：预先从文件夹里摘出（取消会还原），关面板，
   * 无缝移交给桌面拖拽引擎 —— 之后的移动/落格和普通图标一模一样。
   */
  const beginDragOutOfFolder = useCallback(
    (
      pointerId: number,
      x: number,
      y: number,
      iconId: DesktopIconId,
      folderId: string,
      element: HTMLElement,
    ) => {
      const folder = foldersRef.current[folderId];
      if (!folder || !folder.icons.includes(iconId)) return;
      setEditMode(true);
      try {
        navigator.vibrate?.(30);
      } catch {
        /* 不支持就算了 */
      }
      const activePageKeys = sortPageKeys(Object.keys(layoutRef.current));
      const pageKey =
        activePageKeys[Math.min(currentPageIndexRef.current, activePageKeys.length - 1)] ?? 'page1';
      // sourcePage 挂在当前页上只是占位；fromOutside 逻辑靠 sourceFolderId 分流
      startDragPending(pointerId, x, y, 'icon', iconId, pageKey, element);
      const drag = editDragRef.current;
      if (!drag) return;
      drag.sourceFolderId = folderId;
      setFolders((current) => ({
        ...current,
        [folderId]: { ...current[folderId], icons: current[folderId].icons.filter((id) => id !== iconId) },
      }));
      setOpenFolderId(null);
      activateDragAt(pointerId, x, y);
    },
    [startDragPending, activateDragAt],
  );

  const handleFolderIconPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, iconId: DesktopIconId) => {
      const folderId = openFolderId;
      if (!folderId) return;
      e.preventDefault();
      const element = e.currentTarget as HTMLElement;
      const { pointerId, clientX, clientY } = e;
      cancelFolderIconPress();
      folderPressRef.current = {
        timer: window.setTimeout(() => {
          folderPressRef.current = null;
          beginDragOutOfFolder(pointerId, clientX, clientY, iconId, folderId, element);
        }, 500),
        pointerId,
        startX: clientX,
        startY: clientY,
      };
    },
    [openFolderId, cancelFolderIconPress, beginDragOutOfFolder],
  );

  const handleFolderIconPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const press = folderPressRef.current;
      if (!press || press.pointerId !== e.pointerId) return;
      const dx = e.clientX - press.startX;
      const dy = e.clientY - press.startY;
      // 移动超过阈值当作翻页/滚动手势，放弃长按
      if (dx * dx + dy * dy > 100) cancelFolderIconPress();
    },
    [cancelFolderIconPress],
  );

  const renameFolder = useCallback((folderId: string, name: string) => {
    const folder = foldersRef.current[folderId];
    if (!folder) return;
    const trimmed = name.trim().slice(0, 24) || '文件夹';
    if (trimmed === folder.name) return;
    const next = { ...foldersRef.current, [folderId]: { ...folder, name: trimmed } };
    setFolders(next);
    saveDesktopFolders(next);
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    const next = widgetsRef.current.filter((w) => w.id !== widgetId);
    widgetsRef.current = next;
    setWidgets(next);
    saveWidgets(next);
  }, []);

  /** 组件配置更新（相框换图 / 便签改文案等） */
  const updateWidgetConfig = useCallback((widgetId: string, config: Record<string, unknown>) => {
    const next = widgetsRef.current.map((w) => (w.id === widgetId ? { ...w, config } : w));
    widgetsRef.current = next;
    setWidgets(next);
    saveWidgets(next);
  }, []);

  /**
   * 从桌面删除一个图标（真手机「长按 → 点左上角 ×」）：
   * 页面格子 / Dock / 文件夹三处一起摘掉并落盘；系统入口（微信 / 应用市场）不允许删。
   */
  const removeDesktopIcon = useCallback(
    (iconId: string) => {
      if (UNDELETABLE_ICONS.has(iconId)) {
        showDesktopHint('系统应用不能删除');
        return;
      }
      const label = resolveIconMeta(iconId as DesktopIconId)?.label || '应用';
      const nextLayout = cloneLayout(layoutRef.current);
      for (const key of Object.keys(nextLayout)) {
        const page = nextLayout[key];
        if (!page) continue;
        nextLayout[key] = page.filter((ic) => ic.id !== iconId);
      }
      const nextDock = dockRef.current.filter((id) => String(id) !== iconId);
      const nextFolders = { ...foldersRef.current };
      for (const [fid, folder] of Object.entries(nextFolders)) {
        if (!folder.icons.some((id) => String(id) === iconId)) continue;
        const icons = folder.icons.filter((id) => String(id) !== iconId);
        if (icons.length === 0) {
          // 成员删空了：文件夹本身也一起收掉，避免桌面上留一个空文件夹
          delete nextFolders[fid];
          for (const key of Object.keys(nextLayout)) {
            const page = nextLayout[key];
            if (page) nextLayout[key] = page.filter((ic) => String(ic.id) !== fid);
          }
        } else {
          nextFolders[fid] = { ...folder, icons };
        }
      }
      layoutRef.current = nextLayout;
      dockRef.current = nextDock;
      foldersRef.current = nextFolders;
      setLayout(nextLayout);
      setDock(nextDock);
      setFolders(nextFolders);
      saveIconLayout(nextLayout);
      saveDockLayout(nextDock);
      saveDesktopFolders(nextFolders);
      if (iconId.startsWith('plugin:')) removePluginDesktopMeta(iconId.slice('plugin:'.length));
      // 记下「用户主动删掉的」：下次挂载时不要被「核心入口自动补回」又加回来
      markIconRemoved(iconId);
      showDesktopHint(`已从桌面移除「${label}」，可在应用市场重新安装`);
    },
    [showDesktopHint],
  );

  /** 普通图标 + 应用市场插件（plugin:<folder>）统一取显示信息，避免插件图标在文件夹/Dock 里消失 */
  function resolveIconMeta(id: DesktopIconId): { label: string; tone: string; pluginIcon?: string } | null {
    const base = (ICONS as Record<string, { label: string; tone: string } | undefined>)[String(id)];
    if (base) return { label: base.label, tone: base.tone };
    const raw = String(id);
    if (raw.startsWith('plugin:')) {
      const folder = raw.slice('plugin:'.length);
      const pm = readPluginDesktopMeta()[folder];
      return { label: pm?.name || '插件', tone: '#8b7bd8', pluginIcon: pm?.icon };
    }
    return null;
  }

  // 文件夹 tile 里的迷你图标：画小号 glyph
  function renderFolderMini(memberId: DesktopIconId) {
    if (isFolderIconId(memberId)) return null;
    const meta = resolveIconMeta(memberId);
    if (!meta) return null;
    return (
      <span key={memberId} className="folder-mini" aria-hidden>
        {meta.pluginIcon ? (
          <PluginIconImage id={memberId} src={meta.pluginIcon} className="folder-mini-glyph" />
        ) : (
          <IconGlyph id={memberId} className="folder-mini-glyph" />
        )}
      </span>
    );
  }

  // 安卓：拖拽激活后浏览器会把触摸判成滚动并发 pointercancel（拖到一半弹回）。
  // touch-action 触摸开始时就快照了，只能在激活期间用 non-passive touchmove 阻止默认行为。
  useEffect(() => {
    const blockScrollWhileDragging = (event: TouchEvent) => {
      if (editDragRef.current?.active && event.cancelable) event.preventDefault();
    };
    document.addEventListener('touchmove', blockScrollWhileDragging, { passive: false });
    return () => document.removeEventListener('touchmove', blockScrollWhileDragging);
  }, []);

  // ── FLIP：编辑/拖拽中，图标让位时平滑滑到新格（grid 行列本身不可过渡）──
  // 坐标取相对所在 icon-grid 的局部值，整页横滑平移不会误触发动画。
  useLayoutEffect(() => {
    const editing = editMode || dragItem !== null;
    if (!editing) {
      if (flipRectsRef.current.size) flipRectsRef.current = new Map();
      return;
    }
    const prev = flipRectsRef.current;
    const next = new Map<string, { x: number; y: number }>();
    const entries: Array<{ el: HTMLElement; key: string; x: number; y: number }> = [];
    for (const pageKey of pageKeys) {
      const grid = gridRefs.current[pageKey];
      if (!grid) continue;
      // 测量前清掉上一轮 FLIP 残留的 transform，避免量到动画中间值（同步无重绘，安全）
      const els = grid.querySelectorAll<HTMLElement>('[data-flip-id]');
      els.forEach((el) => {
        if (el.dataset.flipActive) {
          el.style.transition = 'none';
          el.style.transform = '';
          delete el.dataset.flipActive;
          el.removeAttribute('data-flip-active');
        }
      });
      const gridRect = grid.getBoundingClientRect();
      els.forEach((el) => {
        const key = `${pageKey}|${el.dataset.flipId}`;
        const r = el.getBoundingClientRect();
        const x = r.left - gridRect.left;
        const y = r.top - gridRect.top;
        next.set(key, { x, y });
        entries.push({ el, key, x, y });
      });
    }
    const moved: HTMLElement[] = [];
    for (const item of entries) {
      const before = prev.get(item.key);
      if (!before) continue;
      const dx = before.x - item.x;
      const dy = before.y - item.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      if (item.el.classList.contains('dragging') || item.el.closest('.dragging')) continue;
      item.el.style.transition = 'none';
      item.el.style.transform = `translate(${dx}px, ${dy}px)`;
      item.el.dataset.flipActive = '1';
      item.el.setAttribute('data-flip-active', '1');
      moved.push(item.el);
    }
    if (moved.length) {
      // 强制一次 reflow，让起始 transform 先生效
      void moved[0].offsetWidth;
      for (const el of moved) {
        el.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = '';
      }
      window.setTimeout(() => {
        for (const el of moved) {
          el.style.transition = '';
          delete el.dataset.flipActive;
          el.removeAttribute('data-flip-active');
        }
      }, 240);
    }
    flipRectsRef.current = next;
  });

  // ── 翻页手势 ────────────────────────────────────────────────

  const handleSwipeStart = useCallback(
    (e: ReactPointerEvent) => {
      // 编辑态点空白 = 退出（源：tap on empty → exitEditMode，位移超过 10px 判为滑动）
      if (editMode) {
        const target = e.target as HTMLElement;
        blankTapRef.current = target.closest('.icon-item, .dock-item')
          ? null
          : { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      } else {
        // 非编辑态长按桌面空白 500ms → 进入编辑（Missy 交互参考：onDesktopPointerDown）
        const target = e.target as HTMLElement;
        const onItem = target.closest(
          '.icon-item, .dock-item, .widget-drag-wrap, .folder-app, .edit-mode-done',
        );
        if (!onItem) {
          cancelBlankPress();
          blankPressRef.current = {
            timer: window.setTimeout(() => {
              blankPressRef.current = null;
              setEditMode(true);
              try {
                navigator.vibrate?.(30);
              } catch {
                /* 不支持就算了 */
              }
            }, 500),
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
          };
        }
      }
      const s = swipeRef.current;
      s.startX = e.clientX;
      s.startY = e.clientY;
      s.deltaX = 0;
      s.locked = null;
      s.pointerId = e.pointerId;
      // 拖动期间关掉回弹过渡，保证 1:1 跟手
      swipeLayerRef.current?.classList.add('phone-swipe-dragging');
    },
    [editMode, cancelBlankPress],
  );

  const handleSwipeMove = useCallback(
    (e: ReactPointerEvent) => {
      const lp = longPressRef.current;
      if (lp && lp.pointerId === e.pointerId) {
        const dx2 = e.clientX - lp.startX;
        const dy2 = e.clientY - lp.startY;
        if (dx2 * dx2 + dy2 * dy2 > 100) cancelLongPress();
      }

      const bp = blankPressRef.current;
      if (bp && bp.pointerId === e.pointerId) {
        const bx = e.clientX - bp.startX;
        const by = e.clientY - bp.startY;
        if (bx * bx + by * by > 100) cancelBlankPress();
      }

      // ── 编辑态拖拽 ──
      const drag = editDragRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        if (drag.pending) {
          const ddx = e.clientX - drag.startX;
          const ddy = e.clientY - drag.startY;
          if (ddx * ddx + ddy * ddy > 9) activateDragAt(e.pointerId, e.clientX, e.clientY);
          return;
        }
        if (drag.active) {
          updateGhostPos(e.clientX, e.clientY);
          updateDropTargetFromPointer(e.clientX, e.clientY);
          checkEdgeSwitch(e.clientX);
          return;
        }
      }

      const s = swipeRef.current;
      if (s.pointerId === null || s.pointerId !== e.pointerId) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      if (s.locked === null) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          s.locked = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          if (s.locked === 'x') {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
        } else {
          return;
        }
      }

      if (s.locked !== 'x') return;

      // 越过首页/末页时做 0.25 橡皮筋，再用「相对当前页的偏移」写 --swipe-drag
      const pageWidth = getSwipePageWidth();
      const page = currentPageIndexRef.current;
      let translateX = -page * pageWidth + dx;
      const minTranslateX = -Math.max(0, pageCount - 1) * pageWidth;
      if (translateX > 0) translateX *= 0.25;
      if (translateX < minTranslateX) translateX = minTranslateX + (translateX - minTranslateX) * 0.25;

      s.deltaX = dx;
      setSwipeDrag(translateX + page * pageWidth);
    },
    [
      getSwipePageWidth,
      pageCount,
      setSwipeDrag,
      cancelLongPress,
      activateDragAt,
      updateGhostPos,
      updateDropTargetFromPointer,
      checkEdgeSwitch,
    ],
  );

  const handleSwipeEnd = useCallback(
    (e: ReactPointerEvent) => {
      cancelLongPress();
      cancelBlankPress();
      swipeLayerRef.current?.classList.remove('phone-swipe-dragging');

      // ── 编辑态拖拽落位 ──
      const drag = editDragRef.current;
      if (drag && drag.pointerId === e.pointerId) {
        commitDrop();
        return;
      }

      // 编辑态点空白退出（位移 ≤10px 才算点击）
      if (editMode) {
        const tap = blankTapRef.current;
        if (tap && tap.pointerId === e.pointerId) {
          const tdx = e.clientX - tap.x;
          const tdy = e.clientY - tap.y;
          blankTapRef.current = null;
          swipeRef.current.pointerId = null;
          if (tdx * tdx + tdy * tdy <= 100) {
            exitEditMode();
            return;
          }
        }
        blankTapRef.current = null;
      }

      const s = swipeRef.current;
      if (s.pointerId === null || s.pointerId !== e.pointerId) return;
      s.pointerId = null;

      const dx = s.deltaX;
      s.deltaX = 0;
      const pageWidth = getSwipePageWidth();
      const swipeThreshold = Math.max(SWIPE_MIN_THRESHOLD, pageWidth * SWIPE_THRESHOLD_RATIO);

      const page = currentPageIndexRef.current;
      let targetPageIndex = page;
      if (Math.abs(dx) > swipeThreshold) {
        targetPageIndex = Math.min(Math.max(0, pageCount - 1), Math.max(0, page + (dx < 0 ? 1 : -1)));
      }

      setSwipeDrag(0);
      if (targetPageIndex !== page) setCurrentPageIndex(targetPageIndex);
    },
    [getSwipePageWidth, pageCount, setSwipeDrag, cancelLongPress, editMode, commitDrop, exitEditMode, cancelBlankPress],
  );

  return (
    <>
      <div
        ref={workspaceRef}
        className={editMode ? 'phone-workspace edit-mode' : 'phone-workspace'}
        style={{ touchAction: editMode ? 'none' : 'pan-y' }}
        onPointerDown={handleSwipeStart}
        onPointerMove={handleSwipeMove}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={handleSwipeEnd}
      >
        {editMode && (
          <button type="button" className="edit-mode-done" onClick={exitEditMode}>
            完成
          </button>
        )}
        <div
          ref={swipeLayerRef}
          className="phone-swipe-layer"
          style={{ '--swipe-page': currentPageIndex } as CSSProperties}
        >
          {pageKeys.map((pageKey, pageIndex) => {
            const pageIcons = layout[pageKey] ?? [];
            return (
              <section
                key={pageKey}
                ref={(el) => {
                  gridRefs.current[pageKey] = el;
                }}
                className={`icon-grid icon-grid-explicit icon-grid-${pageKey}`}
                aria-label={pageIndex === 0 ? '桌面图标' : undefined}
              >
                {/* 桌面组件（clock / calendar） */}
                {widgets
                  .filter((w) => w.page === pageIndex + 1)
                  .map((widget) => (
                    <Fragment key={widget.id}>
                      <div
                        className={
                          dragItem?.type === 'widget' && dragItem.id === widget.id
                            ? 'widget-drag-wrap dragging'
                            : 'widget-drag-wrap'
                        }
                        onPointerDown={(e) =>
                          handleItemPointerDown(e, 'widget', widget.id, pageKey)
                        }
                      >
                        <FloatPhoneWidget widget={widget} onConfigChange={updateWidgetConfig} />
                      </div>
                      {editMode && (
                        <button
                          type="button"
                          className="widget-delete-btn"
                          style={{ gridRow: widget.row, gridColumn: widget.col + 1 }}
                          aria-label="删除组件"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWidget(widget.id);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </Fragment>
                  ))}

                {pageIcons.map((pos) => {
                  const isDragging = dragItem?.type === 'icon' && dragItem.id === pos.id;
                  const isMergeTarget = mergeTargetId === pos.id;
                  const itemClass = `icon-item${isDragging ? ' dragging' : ''}${isMergeTarget ? ' merge-target' : ''}`;

                  // 文件夹 tile：迷你九宫格 + 名字
                  if (isFolderIconId(pos.id)) {
                    const folder = folders[pos.id];
                    if (!folder) return null;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        data-flip-id={`icon:${pos.id}`}
                        className={itemClass}
                        style={{ gridRow: pos.row, gridColumn: pos.col }}
                        onPointerDown={(e) => handleItemPointerDown(e, 'icon', pos.id, pageKey)}
                        onClick={() => {
                          if (!editMode) {
                            setFolderPageIndex(0);
                            setOpenFolderId(pos.id);
                          }
                        }}
                      >
                        <span className="icon-glyph-box folder-glyph-box" aria-hidden>
                          <span className="folder-mini-grid">
                            {folder.icons.slice(0, 4).map((memberId) => renderFolderMini(memberId))}
                          </span>
                        </span>
                        <span className="icon-label">{folder.name}</span>
                      </button>
                    );
                  }

                  const iconId: IconId = pos.id;
                  // 应用市场装到桌面的插件：ICONS 里没有，按 plugin:<folder> 从元数据取名字和图标
                  const pluginFolder = String(pos.id).startsWith('plugin:')
                    ? String(pos.id).slice('plugin:'.length)
                    : '';
                  const pluginMeta = pluginFolder ? readPluginDesktopMeta()[pluginFolder] : undefined;
                  const icon = ICONS[iconId] ??
                    (pluginFolder
                      ? ({ label: pluginMeta?.name || '插件', tone: '#8b7bd8' } as unknown as (typeof ICONS)[IconId])
                      : undefined);
                  if (!icon) return null;
                  // 主题包里的皮肤名与本项目图标 id 不完全一致（resource_hub ↔ resources 等），统一走别名解析
                  const skin = resolveThemePackSkin(packSkins, iconId);
                  // 主题包里没有这个 App 的皮肤图（微信 / QQ 等）：用主题同色系的兜底底板
                  const themed = !skin && themePackActive;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      data-flip-id={`icon:${pos.id}`}
                      className={itemClass}
                      style={{ gridRow: pos.row, gridColumn: pos.col }}
                      onPointerDown={(e) => handleItemPointerDown(e, 'icon', iconId, pageKey)}
                      onClick={() => {
                        if (!editMode) onOpen?.(iconId);
                      }}
                    >
                      <span
                        className={`icon-glyph-box${skin || themed ? ' icon-glyph-box-skin' : ''}${
                          themed ? ' icon-glyph-box-theme' : ''
                        }`}
                        style={{ '--icon-tone': icon.tone } as CSSProperties}
                        aria-hidden
                      >
                        {skin ? (
                          <span className="icon-skin-layer" style={{ backgroundImage: `url("${skin}")` }} />
                        ) : pluginMeta?.icon ? (
                          <PluginIconImage id={iconId} src={pluginMeta.icon} className="icon-glyph" />
                        ) : (
                          <IconGlyph id={iconId} className="icon-glyph" />
                        )}
                      </span>
                      <span className="icon-label">{icon.label}</span>
                      {editMode && !UNDELETABLE_ICONS.has(String(iconId)) && (
                        <span
                          className="icon-delete-btn"
                          role="button"
                          aria-label={`删除${icon.label}`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onPointerUp={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDesktopIcon(String(iconId));
                          }}
                        >
                          −
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Drop target indicator */}
                {editMode && dropTarget && dropTarget.page === pageKey && (
                  <div
                    className="drop-indicator"
                    style={{ gridRow: dropTarget.row, gridColumn: dropTarget.col }}
                  />
                )}
              </section>
            );
          })}
        </div>

        <div className="page-controls">
          {pageKeys.map((pageKey, pageIndex) => (
            <button
              key={`dot-${pageKey}`}
              type="button"
              className={currentPageIndex === pageIndex ? 'dot active dot-btn' : 'dot dot-btn'}
              aria-label={`第${pageIndex + 1}页`}
              onClick={() => setCurrentPageIndex(pageIndex)}
            />
          ))}
        </div>
      </div>

      <footer
        ref={dockElRef}
        className={editMode ? 'dock edit-mode' : 'dock'}
        style={{ '--dock-count': Math.max(1, dock.length) } as CSSProperties}
        onPointerMove={handleSwipeMove}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={handleSwipeEnd}
      >
        {dock.map((id) => {
          const icon = resolveIconMeta(id);
          if (!icon) return null;
          const isDragging = dragItem?.type === 'icon' && dragItem.id === id;
          const dockSkin = resolveThemePackSkin(packSkins, id);
          const dockThemed = !dockSkin && themePackActive;
          return (
            <button
              key={id}
              type="button"
              data-flip-id={`icon:${id}`}
              className={isDragging ? 'dock-item dragging' : 'dock-item'}
              onPointerDown={(e) => handleItemPointerDown(e, 'icon', id, DOCK_PAGE_KEY)}
              onClick={() => {
                if (!editMode) onOpen?.(id);
              }}
            >
              <span
                className={`icon-glyph-box dock-glyph-box${dockSkin || dockThemed ? ' icon-glyph-box-skin' : ''}${
                  dockThemed ? ' icon-glyph-box-theme' : ''
                }`}
                style={{ '--icon-tone': icon.tone } as CSSProperties}
                aria-hidden
              >
                {dockSkin ? (
                  <span className="icon-skin-layer" style={{ backgroundImage: `url("${dockSkin}")` }} />
                ) : icon.pluginIcon ? (
                  <PluginIconImage id={id} src={icon.pluginIcon} className="icon-glyph" />
                ) : (
                  <IconGlyph id={id} className="icon-glyph" />
                )}
              </span>
              <span className="icon-label">{icon.label}</span>
              {editMode && !UNDELETABLE_ICONS.has(String(id)) && (
                <span
                  className="icon-delete-btn"
                  role="button"
                  aria-label={`删除${icon.label}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDesktopIcon(String(id));
                  }}
                >
                  −
                </span>
              )}
            </button>
          );
        })}
      </footer>

      {/* 文件夹面板：整屏压暗 + 毛玻璃 */}
      {openFolderId && folders[openFolderId] && (() => {
        const folder = folders[openFolderId];
        const memberPages: DesktopIconId[][] = [];
        for (let i = 0; i < folder.icons.length; i += 4) {
          memberPages.push(folder.icons.slice(i, i + 4));
        }
        if (memberPages.length === 0) memberPages.push([]);
        const boundedFolderPage = Math.min(folderPageIndex, memberPages.length - 1);
        return (
          <div className="folder-overlay" onClick={() => setOpenFolderId(null)}>
            <input
              key={openFolderId}
              className="folder-name-input"
              defaultValue={folder.name}
              maxLength={24}
              aria-label="文件夹名称"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => renameFolder(openFolderId, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
              }}
            />
            <div className="folder-panel" onClick={(e) => e.stopPropagation()}>
              <div
                className="folder-pages"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                  if (idx !== folderPageIndex) setFolderPageIndex(idx);
                }}
              >
                {memberPages.map((members, pageIdx) => (
                  <div key={pageIdx} className="folder-page">
                    {members.map((memberId) => {
                      if (isFolderIconId(memberId)) return null;
                      const meta = resolveIconMeta(memberId);
                      if (!meta) return null;
                      return (
                        <button
                          key={memberId}
                          type="button"
                          className="folder-app"
                          onClick={() => {
                            setOpenFolderId(null);
                            onOpen?.(memberId);
                          }}
                          onPointerDown={(e) => handleFolderIconPointerDown(e, memberId)}
                          onPointerMove={handleFolderIconPointerMove}
                          onPointerUp={cancelFolderIconPress}
                          onPointerCancel={cancelFolderIconPress}
                        >
                          <span
                            className="icon-glyph-box"
                            style={{ '--icon-tone': meta.tone } as CSSProperties}
                            aria-hidden
                          >
                            {meta.pluginIcon ? (
                              <PluginIconImage id={memberId} src={meta.pluginIcon} className="icon-glyph" />
                            ) : (
                              <IconGlyph id={memberId} className="icon-glyph" />
                            )}
                          </span>
                          <span className="icon-label">{meta.label}</span>
                          {!UNDELETABLE_ICONS.has(String(memberId)) && (
                            <span
                              className="icon-delete-btn"
                              role="button"
                              aria-label={`删除${meta.label}`}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onPointerMove={(e) => e.stopPropagation()}
                              onPointerUp={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDesktopIcon(String(memberId));
                              }}
                            >
                              −
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {memberPages.length > 1 && (
                <div className="folder-dots">
                  {memberPages.map((_, pageIdx) => (
                    <span
                      key={pageIdx}
                      className={pageIdx === boundedFolderPage ? 'dot active' : 'dot'}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Drag ghost — 绝对定位在 .phone-shell 坐标系内，跟随指针 */}
      <div ref={ghostRef} className="drag-ghost" />
      {/* 删除图标后的轻提示 */}
      {desktopHint && <div className="desktop-hint">{desktopHint}</div>}
    </>
  );
}
