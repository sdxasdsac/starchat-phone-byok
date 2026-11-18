// 移植自 ai-virtual-phone-main/lib/desktop-layout-storage.ts（图标布局 / Dock / 文件夹的读写与校验）
// 存储键与 JSON 结构保持一致；源项目走 IndexedDB(kv-db)，本项目用 localStorage 同键替身。
import { GRID_COLS, GRID_ROWS } from '@/components/phone/float-phone-grid';
import {
  ICONS,
  isFolderIconId,
  type DesktopFolderMap,
  type DesktopIconId,
  type DesktopLayout,
  type IconId,
  type IconPosition,
} from '@/components/phone/float-phone-icons';
import { isValidWidget, type WidgetInstance } from '@/components/phone/float-widgets';

// 独立存储命名空间：避免和同域下其它 float 小手机共用桌面布局
export const ICON_LAYOUT_STORAGE_KEY = 'sp_icon_layout_v1';
export const DOCK_LAYOUT_STORAGE_KEY = 'sp_dock_layout_v1';
export const DESKTOP_FOLDERS_STORAGE_KEY = 'sp_desktop_folders_v1';
export const WIDGETS_STORAGE_KEY = 'sp_widgets_v1';
/** 源 lib/desktop-layout-storage.ts：DOCK_MAX = 4 */
export const DOCK_MAX = 4;

const KNOWN_ICONS = new Set<string>(Object.keys(ICONS));

function isKnownIcon(id: string): id is IconId {
  // plugin:<folder> 是应用市场插件装到桌面后的动态图标，允许持久化
  return KNOWN_ICONS.has(id) || id.startsWith('plugin:');
}

/** page12 → 12（源 getDesktopPageNumber） */
function pageNumberOf(key: string): number {
  const match = key.match(/^page([1-9]\d*)$/);
  return match ? Number(match[1]) : 0;
}

/** 源 getDesktopPageKeys：至少保留 2 页 */
function pageKeysOf(layout: Record<string, unknown>): string[] {
  const maxPage = Math.max(
    2,
    ...Object.keys(layout)
      .map(pageNumberOf)
      .filter((n) => Number.isInteger(n) && n >= 1),
  );
  return Array.from({ length: maxPage }, (_, index) => `page${index + 1}`);
}

// ── 文件夹 ───────────────────────────────────────────

export function normalizeDesktopFolders(raw: unknown): DesktopFolderMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const seen = new Set<string>();
  const result: DesktopFolderMap = {};
  for (const [folderId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!folderId.startsWith('folder:') || !value || typeof value !== 'object') continue;
    const { name, icons } = value as { name?: unknown; icons?: unknown };
    if (!Array.isArray(icons)) continue;
    const members: DesktopIconId[] = [];
    for (const item of icons) {
      if (typeof item !== 'string' || isFolderIconId(item) || !isKnownIcon(item)) continue;
      if (seen.has(item) || members.includes(item)) continue;
      seen.add(item);
      members.push(item);
    }
    result[folderId] = {
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : '文件夹',
      icons: members,
    };
  }
  return result;
}

// ── 图标布局 ─────────────────────────────────────────

function normalizePage(raw: unknown, folders: DesktopFolderMap): IconPosition[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenCells = new Set<string>();
  const result: IconPosition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, row, col } = item as { id?: unknown; row?: unknown; col?: unknown };
    if (typeof id !== 'string' || typeof row !== 'number' || typeof col !== 'number') continue;
    // 没有成员表的 folder tile 是空壳，直接丢弃
    const valid = isFolderIconId(id) ? Boolean(folders[id]) : isKnownIcon(id);
    if (!valid || !Number.isInteger(row) || !Number.isInteger(col)) continue;
    if (row < 1 || row > GRID_ROWS || col < 1 || col > GRID_COLS) continue;
    const cellKey = `${row},${col}`;
    if (seenIds.has(id) || seenCells.has(cellKey)) continue;
    seenIds.add(id);
    seenCells.add(cellKey);
    result.push({ id: id as DesktopIconId, row, col });
  }
  return result;
}

export function normalizeIconLayout(raw: unknown, folders: DesktopFolderMap): DesktopLayout {
  if (!raw || typeof raw !== 'object') return {};
  const candidate = raw as Record<string, unknown>;
  const normalized: DesktopLayout = {};
  for (const pageKey of pageKeysOf(candidate)) {
    normalized[pageKey] = normalizePage(candidate[pageKey], folders);
  }
  return normalized;
}

// ── Dock ─────────────────────────────────────────────

export function normalizeDock(raw: unknown): IconId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: IconId[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!isKnownIcon(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= DOCK_MAX) break;
  }
  return result;
}

// ── 读写 ─────────────────────────────────────────────

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 配额/隐私模式失败就算了，不阻塞交互 */
  }
}

export function loadDesktopFolders(): DesktopFolderMap {
  const raw = readRaw(DESKTOP_FOLDERS_STORAGE_KEY);
  if (raw == null) return {};
  try {
    return normalizeDesktopFolders(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveDesktopFolders(folders: DesktopFolderMap): void {
  writeRaw(DESKTOP_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
}

export function loadIconLayout(fallback: DesktopLayout): DesktopLayout {
  const raw = readRaw(ICON_LAYOUT_STORAGE_KEY);
  if (raw == null) return fallback;
  try {
    const folders = loadDesktopFolders();
    const normalized = normalizeIconLayout(JSON.parse(raw), folders);
    // 空布局（首次写入失败/被清空）回落到默认，避免整桌空白
    const hasAny = Object.values(normalized).some((page) => page.length > 0);
    return hasAny ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function saveIconLayout(layout: DesktopLayout): void {
  writeRaw(ICON_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export function loadDockLayout(fallback: IconId[]): IconId[] {
  const raw = readRaw(DOCK_LAYOUT_STORAGE_KEY);
  if (raw == null) return fallback;
  try {
    const normalized = normalizeDock(JSON.parse(raw));
    return normalized.length ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function saveDockLayout(dock: IconId[]): void {
  writeRaw(DOCK_LAYOUT_STORAGE_KEY, JSON.stringify(dock));
}

// ── 桌面组件 ─────────────────────────────────────────

export function loadWidgets(fallback: WidgetInstance[]): WidgetInstance[] {
  const raw = readRaw(WIDGETS_STORAGE_KEY);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidWidget).map((widget) => ({ ...widget }));
  } catch {
    return [];
  }
}

export function saveWidgets(widgets: WidgetInstance[]): void {
  writeRaw(WIDGETS_STORAGE_KEY, JSON.stringify(widgets));
}
