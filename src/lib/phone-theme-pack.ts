/**
 * 主题包（美化库）：一个包 = 一张桌面壁纸 + 若干图标皮肤。
 * 数据来自 public/phone-assets/theme-packs/index.json（由美化库 zip 解包生成），
 * 应用后写入 localStorage，桌面 / Dock / 素材仓库共用同一份。
 */
import { WALLPAPER_EVENT, WALLPAPER_KEY } from '@/lib/phone-theme';
import { assetPath } from '@/lib/base-path';

export interface ThemePack {
  slug: string;
  name: string;
  desc?: string;
  icons?: number;
  wallpaper: string | null;
  /** 图标 id → 皮肤图片地址（与桌面 IconId 同名） */
  skins: Record<string, string>;
  /** 主题自带的配色变量（--c-* / --desktop-*），注入后整套 UI 跟着变 */
  cssVars?: Record<string, string>;
  /** 主题作者自定义 CSS（少数包带） */
  customCss?: string;
  /** 主题自带字体文件地址 */
  fontUrl?: string | null;
  /** 壁纸缩放百分比 */
  wallpaperScale?: number;
}

export const THEME_PACK_KEY = 'starchat.phone.themePack';
export const THEME_PACK_EVENT = 'starchat:phone-theme-pack';
/** 壁纸 id 前缀：tp-<slug> 表示当前壁纸来自主题包 */
export const THEME_PACK_WALLPAPER_PREFIX = 'tp-';

/** 默认美化：黑白熊（全局美化包转成的主题包） */
export const DEFAULT_THEME_PACK: ThemePack = {
  slug: 'bear',
  name: '黑白熊',
  desc: '全局美化 · 黑白灰玻璃',
  icons: 0,
  wallpaper: assetPath('/phone-assets/theme-packs/bear/01.jpg'),
  skins: {},
  cssVars: {
    '--desktop-global-shadow': '1',
    '--app-text-scale': '0.85',
    '--desktop-icon-effect': 'glass',
    '--desktop-outline-opacity': '1',
    '--c-desktop-icon': '#ebebeb',
    '--c-page-body-bg': '#f1f2f6',
    '--c-input': '#f2f3f5',
    '--c-header-bg': '#ffffff',
    '--desktop-outline-width': '1.30308219178082',
    '--c-desktop-icon-box': 'rgba(0, 0, 0, 0.166666666666667)',
    '--c-home-label': '#c2c2c2',
    '--c-home-card': 'rgba(0, 0, 0, 0)',
    '--c-home-text': 'rgba(255, 255, 255, 0.533333333333333)',
    '--c-home-border': 'rgba(71, 71, 71, 0.5)',
    '--c-home-sub': '#c2c2c2',
    '--c-home-pink': '#999999',
    '--desktop-widget-effect': 'glass',
  },
  customCss: '',
  fontUrl: null,
  wallpaperScale: 100,
};

export function readActiveThemePack(): ThemePack | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(THEME_PACK_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as Partial<ThemePack>;
    if (typeof row.slug !== 'string' || typeof row.name !== 'string') return null;
    return {
      slug: row.slug,
      name: row.name,
      desc: row.desc,
      icons: row.icons,
      wallpaper: typeof row.wallpaper === 'string' ? assetPath(row.wallpaper) : null,
      skins:
        row.skins && typeof row.skins === 'object'
          ? Object.fromEntries(
              Object.entries(row.skins as Record<string, string>).map(([key, url]) => [key, assetPath(url)]),
            )
          : {},
      cssVars: row.cssVars && typeof row.cssVars === 'object' ? (row.cssVars as Record<string, string>) : {},
      customCss: typeof row.customCss === 'string' ? row.customCss : '',
      fontUrl: typeof row.fontUrl === 'string' ? assetPath(row.fontUrl) : null,
      wallpaperScale: typeof row.wallpaperScale === 'number' ? row.wallpaperScale : 100,
    };
  } catch {
    return null;
  }
}

/** 主题包样式层：把配色变量 / 自定义 CSS / 字体注入到小手机根节点 */
const PACK_STYLE_ID = 'starchat-theme-pack-style';

export function applyThemePackStyles(pack: ThemePack | null): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(PACK_STYLE_ID);
  if (!pack) {
    el?.remove();
    return;
  }
  const vars = Object.entries(pack.cssVars ?? {})
    .filter(([k]) => k.startsWith('--'))
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  const font = pack.fontUrl
    ? `@font-face{font-family:'StarThemePack';src:url("${pack.fontUrl}");font-display:swap;}` +
      `.phone-screen{--app-font-family:'StarThemePack',var(--app-font-family);}`
    : '';
  // 把主题包里的取色变量再映射成一套私有变量，供下面「无皮肤图标」的兜底样式使用
  const iconVars = [
    pack.cssVars?.['--c-desktop-icon'] ? `--theme-pack-icon:${pack.cssVars['--c-desktop-icon']};` : '',
    pack.cssVars?.['--c-desktop-icon-box'] ? `--theme-pack-icon-box:${pack.cssVars['--c-desktop-icon-box']};` : '',
    pack.cssVars?.['--c-home-label'] ? `--theme-pack-label:${pack.cssVars['--c-home-label']};` : '',
  ]
    .filter(Boolean)
    .join('');
  const hasSkins = Object.keys(pack.skins ?? {}).length > 0;
  // 主题包只给一部分 App 画了皮肤图。没皮肤的图标不能再沿用奶油粉底板，否则主题看起来「只生效了一半」。
  const iconFallback = hasSkins
    ? [
        `.phone-screen{${iconVars}}`,
        `.fp-root .phone-shell .icon-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin),
         .fp-root .phone-shell .dock-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin){` +
          `--c-desktop-icon:var(--theme-pack-icon,#5f646b)!important;` +
          `--p-icon-sticker:none!important;` +
          `background:var(--theme-pack-icon-box,rgba(255,255,255,.4))!important;` +
          `border:1px solid rgba(255,255,255,.72)!important;border-radius:24%!important;` +
          `box-shadow:0 6px 18px rgba(0,0,0,.08)!important;color:var(--theme-pack-icon,#5f646b)!important;` +
          `overflow:hidden!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;}`,
        `.fp-root .phone-shell .icon-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin)::before,
         .fp-root .phone-shell .dock-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin)::before,
         .fp-root .phone-shell .icon-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin)::after,
         .fp-root .phone-shell .dock-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin)::after{content:none!important;display:none!important;}`,
        `.fp-root .phone-shell .icon-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin) .icon-glyph,
         .fp-root .phone-shell .dock-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin) .icon-glyph{color:var(--theme-pack-icon,#5f646b)!important;}`,
        `.fp-root .phone-shell .icon-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin) .icon-glyph path,
         .fp-root .phone-shell .dock-item:nth-child(n) .icon-glyph-box:not(.icon-glyph-box-skin) .icon-glyph path{fill:var(--theme-pack-icon,#5f646b)!important;filter:none!important;}`,
        `.fp-root .phone-shell .icon-item:nth-child(n) .icon-label{color:var(--theme-pack-label,#6c7279)!important;text-shadow:none!important;}`,
      ].join('\n')
    : '';
  const css = [
    // 主题包变量只作用在小手机壳内，不影响站点其它页面
    vars ? `.phone-screen,.os-root,.phone-shell{${vars}}` : '',
    font,
    iconFallback,
    pack.customCss ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  if (!css) {
    el?.remove();
    return;
  }
  const node = el ?? document.createElement('style');
  node.id = PACK_STYLE_ID;
  node.textContent = css;
  if (!el) document.head.appendChild(node);
}

/** 应用主题包：写记录 + 切壁纸 + 注入配色样式；传 null 表示取消（恢复默认壁纸） */
export function applyThemePack(pack: ThemePack | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (pack) window.localStorage.setItem(THEME_PACK_KEY, JSON.stringify(pack));
    else window.localStorage.removeItem(THEME_PACK_KEY);
    if (pack?.wallpaper) {
      window.localStorage.setItem(WALLPAPER_KEY, `${THEME_PACK_WALLPAPER_PREFIX}${pack.slug}`);
    } else if (!pack) {
      window.localStorage.removeItem(WALLPAPER_KEY);
    }
  } catch {
    // 隐私模式下忽略：本次会话内仍按内存状态生效
  }
  applyThemePackStyles(pack);
  window.dispatchEvent(new Event(THEME_PACK_EVENT));
  window.dispatchEvent(new Event(WALLPAPER_EVENT));
}

/** 主题包皮肤名 ↔ 本项目图标 id 的别名（历史图标 id 与主题包命名不一致） */
const SKIN_ALIASES: Record<string, string[]> = {
  characters: ['mixology'],
  resources: ['resource_hub'],
  shopping: ['shop'],
  game: ['games'],
  appmarket: ['app_market'],
};

/**
 * 取某个桌面图标在当前主题包里的皮肤地址。
 * 先精确匹配，再按别名互相兜底（如 resource_hub ↔ resources）。
 */
export function resolveThemePackSkin(skins: Record<string, string>, iconId: string): string | null {
  if (skins[iconId]) return skins[iconId];
  for (const [canonical, aliases] of Object.entries(SKIN_ALIASES)) {
    if (canonical !== iconId && !aliases.includes(iconId)) continue;
    if (skins[canonical]) return skins[canonical];
    for (const alias of aliases) if (skins[alias]) return skins[alias];
  }
  return null;
}

/** 当前主题包里某个图标的皮肤地址 */
export function getThemePackSkin(iconId: string): string | null {
  const pack = readActiveThemePack();
  return pack ? resolveThemePackSkin(pack.skins, iconId) : null;
}

/** 读取美化库里的全部主题包（index.json） */
export async function loadThemePacks(): Promise<ThemePack[]> {
  try {
    const res = await fetch(assetPath('/phone-assets/theme-packs/index.json'), { cache: 'force-cache' });
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((row) => row as Partial<ThemePack>)
      .filter((row) => typeof row.slug === 'string' && typeof row.name === 'string')
      .map((row) => ({
        slug: String(row.slug),
        name: String(row.name),
        desc: typeof row.desc === 'string' ? row.desc : '',
        icons: typeof row.icons === 'number' ? row.icons : 0,
        wallpaper: typeof row.wallpaper === 'string' ? assetPath(row.wallpaper) : null,
        skins:
          row.skins && typeof row.skins === 'object'
            ? Object.fromEntries(
                Object.entries(row.skins as Record<string, string>).map(([key, url]) => [key, assetPath(url)]),
              )
            : {},
        // 配色 / 自定义 CSS / 字体 / 壁纸缩放：应用主题包时必须一起带上，否则主题只生效一半
        cssVars: row.cssVars && typeof row.cssVars === 'object' ? (row.cssVars as Record<string, string>) : {},
        customCss: typeof row.customCss === 'string' ? row.customCss : '',
        fontUrl: typeof row.fontUrl === 'string' ? assetPath(row.fontUrl) : null,
        wallpaperScale: typeof row.wallpaperScale === 'number' ? row.wallpaperScale : 100,
      }));
  } catch {
    return [];
  }
}
