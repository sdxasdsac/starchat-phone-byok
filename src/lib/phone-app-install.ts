'use client';

// 应用市场「安装到桌面」：把应用图标写进桌面布局（与桌面共用同一份 localStorage 布局）
import {
  DOCK_DEFAULT,
  PAGE_1_DEFAULT,
  PAGE_2_DEFAULT,
  PAGE_3_DEFAULT,
  type DesktopLayout,
  type IconId,
} from '@/components/phone/float-phone-icons';
import { GRID_COLS, GRID_ROWS } from '@/components/phone/float-phone-grid';
import {
  loadDesktopFolders,
  loadDockLayout,
  loadIconLayout,
  loadWidgets,
  saveDesktopFolders,
  saveIconLayout,
} from '@/components/phone/float-phone-storage';
import { buildWidgetOccupancy, createDefaultWidgets } from '@/components/phone/float-widgets';

/**
 * 应用 → 桌面图标。
 * 同一个应用可能对应历史遗留的多个图标（如「素材仓库」同时有 resources / resource_hub），
 * 这里取默认用于安装的那个；判断是否已安装时再看 ALIASES。
 */
export const APP_ICON: Record<string, IconId> = {
  wechat: 'wechat',
  qq: 'qq',
  ai: 'chat',
  diary: 'diary',
  music: 'music',
  calendar: 'calendar',
  checkphone: 'checkphone',
  shop: 'shopping',
  reading: 'reading',
  interview: 'interview_magazine',
  cocreate: 'cocreate',
  games: 'game',
  appmarket: 'appmarket',
  xiaohongshu: 'xiaohongshu',
  dwelling: 'dwelling',
  story: 'story',
  vn: 'vnmode',
  citymap: 'mapmode',
  worldbuild: 'worldbuilder',
  forum: 'forum',
  resources: 'resources',
  reality: 'realitybridge',
  characters: 'characters',
  settings: 'settings',
  theme: 'theme',
  phone: 'phone',
  sms: 'sms',
  douyin: 'douyin',
  inspiration: 'inspiration',
  toy: 'toy',
  memory: 'memory',
  notes: 'notes',
  anniversary: 'anniversary',
  album: 'album',
  stats: 'stats',
  favorites: 'favorites',
  market: 'market',
  backup: 'backup',
  checkup: 'checkup',
  widgetstudio: 'qa',
  room: 'room',
  scene: 'scene',
};

/** 判定「已安装」时要认的所有图标（含历史别名） */
const ICON_ALIASES: Record<string, IconId[]> = {
  shop: ['shopping', 'shop'],
  resources: ['resources', 'resource_hub'],
  characters: ['characters', 'mixology'],
  widgetstudio: ['qa', 'widgetstudio'],
  vn: ['vnmode', 'vnplay', 'vnchapters'],
};

function iconsOf(appId: string): IconId[] {
  return ICON_ALIASES[appId] ?? (APP_ICON[appId] ? [APP_ICON[appId]] : []);
}

/* ---------------- Float 插件应用：桌面图标 ---------------- */

export const PLUGIN_ICON_PREFIX = 'plugin:';
const PLUGIN_META_KEY = 'starchat.phone.pluginDesktopMeta';

export interface PluginDesktopMeta {
  name: string;
  icon: string;
}

/** 已装到桌面的插件元数据：folder → 名称 / 图标 */
export function readPluginDesktopMeta(): Record<string, PluginDesktopMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PLUGIN_META_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PluginDesktopMeta>) : {};
  } catch {
    return {};
  }
}

function writePluginDesktopMeta(meta: Record<string, PluginDesktopMeta>): void {
  try {
    window.localStorage.setItem(PLUGIN_META_KEY, JSON.stringify(meta));
  } catch {
    // 隐私模式忽略
  }
}

/** 从桌面删除插件图标后，同步清掉插件元数据（应用市场里会重新显示为未安装） */
export function removePluginDesktopMeta(folder: string): void {
  if (!folder) return;
  const meta = readPluginDesktopMeta();
  if (!meta[folder]) return;
  delete meta[folder];
  writePluginDesktopMeta(meta);
}

/* ---------------- 用户手动从桌面删掉的图标 ---------------- */

const REMOVED_KEY = 'starchat.phone.removedIcons';

/** 用户删过的图标：桌面挂载时不再把「核心入口」自动补回来 */
export function readRemovedIcons(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REMOVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRemovedIcons(list: string[]): void {
  try {
    window.localStorage.setItem(REMOVED_KEY, JSON.stringify(list));
  } catch {
    // 隐私模式忽略
  }
}

export function markIconRemoved(iconId: string): void {
  const list = readRemovedIcons();
  if (!list.includes(iconId)) writeRemovedIcons([...list, iconId]);
}

/** 重新安装 / 手动放回桌面时解除「已删除」标记 */
export function unmarkIconRemoved(iconId: string): void {
  const list = readRemovedIcons();
  if (!list.includes(iconId)) return;
  writeRemovedIcons(list.filter((x) => x !== iconId));
}

function normalizePluginIcon(folder: string, icon?: string): string {
  const raw = (icon || '').trim();
  if (!raw) return '';
  // 清单里可能是相对文件名（如 icon.png），补全成插件包内路径
  if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
  return `/phone-apps/${folder}/${raw}`;
}

/** 插件应用装到桌面：和普通应用共用同一份布局 */
export function installPluginToDesktop(
  folder: string,
  name: string,
  icon?: string,
): { ok: true; already: boolean } | { ok: false; message: string } {
  if (!folder) return { ok: false, message: '插件信息不完整' };
  if (typeof window === 'undefined') return { ok: false, message: '请在小手机里重试' };
  const iconId = `${PLUGIN_ICON_PREFIX}${folder}` as unknown as IconId;
  const meta = readPluginDesktopMeta();
  // 不再猜一个不存在的 icon.svg：没有图标就留空，桌面按通用字形兜底
  meta[folder] = { name: name || '插件', icon: normalizePluginIcon(folder, icon) };
  writePluginDesktopMeta(meta);

  const placed = placedIcons();
  if (placed.has(iconId)) return { ok: true, already: true };
  if (!placeIconOnPage(iconId)) return { ok: false, message: '桌面已经没有空位了' };
  unmarkIconRemoved(String(iconId));
  return { ok: true, already: false };
}

/** 插件是否已经在桌面（桌面页 / 文件夹 / Dock 任一即可） */
export function isPluginInstalled(folder: string): boolean {
  if (!folder || typeof window === 'undefined') return false;
  const iconId = `${PLUGIN_ICON_PREFIX}${folder}`;
  return placedIcons().has(iconId);
}

const DEFAULT_PAGES: IconId[][] = [PAGE_1_DEFAULT, PAGE_2_DEFAULT, PAGE_3_DEFAULT];

/** 与 FloatPhoneDesktop 的 buildInitialLayout 一致：默认布局转显式行列 */
function buildDefaultLayout(): DesktopLayout {
  const layout: DesktopLayout = {};
  DEFAULT_PAGES.forEach((icons, pageIndex) => {
    layout[`page${pageIndex + 1}`] = icons.slice(0, GRID_ROWS * GRID_COLS).map((id, index) => ({
      id,
      row: Math.floor(index / GRID_COLS) + 1,
      col: (index % GRID_COLS) + 1,
    }));
  });
  return layout;
}

/** 桌面上已存在的所有图标（页面 + 文件夹 + Dock） */
function placedIcons(): Set<string> {
  const set = new Set<string>();
  const layout = loadIconLayout(buildDefaultLayout());
  for (const page of Object.values(layout)) for (const ic of page) set.add(ic.id);
  const folders = loadDesktopFolders();
  for (const folder of Object.values(folders)) for (const id of folder.icons) set.add(id);
  const dock = loadDockLayout(DOCK_DEFAULT);
  for (const id of dock) set.add(id);
  return set;
}

/** 这个应用是否已经在桌面上（有图标就算已安装） */
export function isAppInstalled(appId: string): boolean {
  if (!APP_ICON[appId]) return true;
  const placed = placedIcons();
  return iconsOf(appId).some((icon) => placed.has(icon));
}

function pageNumberOf(key: string): number {
  return Number.parseInt(key.replace(/\D/g, ''), 10) || 1;
}

/**
 * 把图标放进第一个空位并保存布局。
 * 优先第 1 页，其次往后；都满了就新开一页。所有页面都避开桌面组件占用的格子。
 */
function placeIconOnPage(iconId: IconId): boolean {
  const layout = loadIconLayout(buildDefaultLayout());
  const widgets = loadWidgets(createDefaultWidgets());
  const pages = Object.keys(layout);
  const maxPage = Math.max(3, ...pages.map(pageNumberOf));

  for (let page = 1; page <= maxPage + 1 && page <= 8; page += 1) {
    const key = `page${page}`;
    const occupied = new Set((layout[key] ?? []).map((ic) => `${ic.row},${ic.col}`));
    const widgetOcc = buildWidgetOccupancy(widgets, page);
    for (let row = 1; row <= GRID_ROWS; row += 1) {
      for (let col = 1; col <= GRID_COLS; col += 1) {
        if (occupied.has(`${row},${col}`)) continue;
        if (widgetOcc[row - 1]?.[col - 1]) continue;
        layout[key] = layout[key] ?? [];
        layout[key].push({ id: iconId, row, col });
        saveIconLayout(layout);
        return true;
      }
    }
  }
  return false;
}

/** 安装到桌面：找一个空位放图标并保存布局 */
export function installAppToDesktop(
  appId: string,
): { ok: true; already: boolean; iconId: IconId } | { ok: false; message: string } {
  const iconId = APP_ICON[appId];
  if (!iconId) return { ok: false, message: '这个应用不支持放到桌面' };
  if (typeof window === 'undefined') return { ok: false, message: '请在小手机里重试' };

  const placed = placedIcons();
  if (iconsOf(appId).some((icon) => placed.has(icon))) {
    unmarkIconRemoved(String(iconId));
    return { ok: true, already: true, iconId };
  }
  if (!placeIconOnPage(iconId)) return { ok: false, message: '桌面已经没有空位了' };
  unmarkIconRemoved(String(iconId));
  return { ok: true, already: false, iconId };
}

/**
 * 打开应用前确保它在桌面上看得见：
 * - 已经在某页 / Dock 上：什么都不做
 * - 只藏在文件夹里：从文件夹取出，放到页面空位
 * - 完全没有：按安装流程放到空位
 */
export function ensureAppOnDesktop(
  appId: string,
):
  | { ok: true; already: boolean; movedFromFolder: boolean; iconId: IconId }
  | { ok: false; message: string } {
  const iconId = APP_ICON[appId];
  if (!iconId) return { ok: false, message: '这个应用不支持放到桌面' };
  if (typeof window === 'undefined') return { ok: false, message: '请在小手机里重试' };

  const aliases = iconsOf(appId);
  const layout = loadIconLayout(buildDefaultLayout());
  const onPage = Object.values(layout).some((page) =>
    page.some((ic) => (aliases as string[]).includes(ic.id)),
  );
  const onDock = loadDockLayout(DOCK_DEFAULT).some((id) => aliases.includes(id));
  if (onPage || onDock) return { ok: true, already: true, movedFromFolder: false, iconId };

  const folders = loadDesktopFolders();
  let inFolder: IconId | null = null;
  let folderId = '';
  for (const [id, folder] of Object.entries(folders)) {
    const hit = folder.icons.find((icon) => (aliases as string[]).includes(icon));
    if (hit) {
      inFolder = hit as IconId;
      folderId = id;
      break;
    }
  }

  if (!placeIconOnPage(inFolder ?? iconId)) return { ok: false, message: '桌面已经没有空位了' };
  unmarkIconRemoved(String(inFolder ?? iconId));
  if (inFolder) {
    folders[folderId] = {
      ...folders[folderId],
      icons: folders[folderId].icons.filter((icon) => icon !== inFolder),
    };
    saveDesktopFolders(folders);
    return { ok: true, already: false, movedFromFolder: true, iconId: inFolder };
  }
  return { ok: true, already: false, movedFromFolder: false, iconId };
}
