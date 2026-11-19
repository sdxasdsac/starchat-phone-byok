// 小手机桌面壁纸 / 主题预设（桌面与「主题」app 共用）
export interface PhoneWallpaper {
  id: string;
  name: string;
  /** CSS background */
  bg: string;
  /** 三个柔光色团 */
  glows: [string, string, string];
}

export const PHONE_WALLPAPERS: PhoneWallpaper[] = [
  {
    id: 'bunny',
    name: '兔丸奶油',
    bg: 'linear-gradient(158deg,#FFFBF8 0%,#FFEAF2 32%,#F0F4FF 64%,#FFF7EC 100%)',
    glows: ['rgba(255,197,219,0.55)', 'rgba(198,214,255,0.5)', 'rgba(255,236,205,0.45)'],
  },
  {
    id: 'peach',
    name: '蜜桃牛乳',
    bg: 'linear-gradient(160deg,#FFF9F5 0%,#FFE8E0 40%,#FFDFEA 72%,#FFF3E6 100%)',
    glows: ['rgba(255,186,160,0.5)', 'rgba(255,176,201,0.5)', 'rgba(255,232,190,0.45)'],
  },
  {
    id: 'lilac',
    name: '薰衣草奶',
    bg: 'linear-gradient(160deg,#FBFAFF 0%,#EEE9FF 38%,#F3ECFF 70%,#FDF7FF 100%)',
    glows: ['rgba(202,186,255,0.5)', 'rgba(255,200,232,0.42)', 'rgba(196,222,255,0.42)'],
  },
  {
    id: 'aurora',
    name: '晨雾极光',
    bg: 'linear-gradient(158deg,#f8fbff 0%,#eef4ff 30%,#fdf2f7 62%,#eafaf2 100%)',
    glows: ['rgba(201,216,255,0.55)', 'rgba(255,214,228,0.55)', 'rgba(200,240,223,0.5)'],
  },
  {
    id: 'sunset',
    name: '落日橘粉',
    bg: 'linear-gradient(160deg,#fff6ec 0%,#ffe4d6 38%,#ffd9e6 70%,#f3e2ff 100%)',
    glows: ['rgba(255,190,150,0.6)', 'rgba(255,168,196,0.55)', 'rgba(214,190,255,0.5)'],
  },
  {
    id: 'ocean',
    name: '深海蓝调',
    bg: 'linear-gradient(160deg,#eef8ff 0%,#dbeafe 40%,#e0f2fe 70%,#eef2ff 100%)',
    glows: ['rgba(140,190,255,0.55)', 'rgba(120,220,230,0.45)', 'rgba(170,170,255,0.45)'],
  },
  {
    id: 'matcha',
    name: '抹茶青提',
    bg: 'linear-gradient(160deg,#f7fff6 0%,#e8f8e6 38%,#e6fbf3 70%,#f2fdf6 100%)',
    glows: ['rgba(170,230,170,0.5)', 'rgba(160,235,210,0.45)', 'rgba(255,240,190,0.4)'],
  },
  {
    id: 'sky',
    name: '清晨天空',
    bg: 'linear-gradient(160deg,#f4f9ff 0%,#e2efff 35%,#e8e6ff 68%,#f7f4ff 100%)',
    glows: ['rgba(150,190,255,0.5)', 'rgba(190,170,255,0.45)', 'rgba(150,225,235,0.4)'],
  },
  {
    id: 'paper',
    name: '奶油纸感',
    bg: 'linear-gradient(160deg,#fffdf8 0%,#fdf6ea 45%,#f7f1e8 100%)',
    glows: ['rgba(255,225,170,0.4)', 'rgba(240,220,200,0.4)', 'rgba(230,235,245,0.4)'],
  },
  // 说明：/pgc/bg/* 是角色卡的线下场景图，不属于小手机壁纸，这里不再混进来。
];

/** 素材仓库里导入的壁纸记录（localStorage，桌面与仓库共用） */
export interface ImportedWallpaper {
  id: string;
  name: string;
  dataUrl: string;
}

export const IMPORTED_WALLPAPER_KEY = 'starchat.phone.materialVault.wallpaper';

export function readImportedWallpaper(): ImportedWallpaper | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IMPORTED_WALLPAPER_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.dataUrl !== 'string') {
      return null;
    }
    return { id: row.id, name: row.name, dataUrl: row.dataUrl };
  } catch {
    return null;
  }
}

export const DEFAULT_WALLPAPER_ID = 'sky';
export const WALLPAPER_EVENT = 'starchat:phone-wallpaper';
export const WALLPAPER_KEY = 'starchat.phone.wallpaper';
/** 主题版本：老用户第一次打开新版时自动换成「清晨天空」主题 */
const THEME_VERSION_KEY = 'starchat.phone.theme.version';
const THEME_VERSION = '3';

/**
 * 当前主题包（美化库）的壁纸地址。
 * 直接读 localStorage 而不是 import 主题包模块：phone-theme-pack 反过来要用 WALLPAPER_KEY，
 * 互相 import 会形成循环依赖。
 */
function readThemePackWallpaper(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('starchat.phone.themePack');
    if (!raw) return null;
    const row = JSON.parse(raw) as { wallpaper?: unknown };
    return typeof row.wallpaper === 'string' && row.wallpaper ? row.wallpaper : null;
  } catch {
    return null;
  }
}

/** 主题包的壁纸缩放百分比（部分主题把原图放大到 130% 之类） */
function readThemePackWallpaperScale(): number {
  if (typeof window === 'undefined') return 100;
  try {
    const raw = window.localStorage.getItem('starchat.phone.themePack');
    if (!raw) return 100;
    const row = JSON.parse(raw) as { wallpaperScale?: unknown };
    return typeof row.wallpaperScale === 'number' ? row.wallpaperScale : 100;
  } catch {
    return 100;
  }
}

export function getWallpaper(id: string | null | undefined): PhoneWallpaper {
  const found = PHONE_WALLPAPERS.find((w) => w.id === id);
  if (found) return found;
  // 美化库主题包的壁纸（tp-<slug>）：从主题包记录里取图片地址，避免与主题包模块循环依赖
  if (id && id.startsWith('tp-')) {
    const url = readThemePackWallpaper();
    if (url) {
      const scale = readThemePackWallpaperScale();
      // 100% 用 cover（铺满不变形）；主题指定了缩放就按比例放大
      const size = Math.abs(scale - 100) < 0.5 ? 'cover' : `${scale}% auto`;
      return {
        id,
        name: '主题包壁纸',
        bg: `url("${url}") center / ${size} no-repeat`,
        glows: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.1)'],
      };
    }
  }
  // 素材仓库导入的壁纸：刷新后也要能直接还原，不能要求用户再进一次仓库
  if (id && id.startsWith('mv-')) {
    const stored = readImportedWallpaper();
    if (stored && `mv-${stored.id}` === id) {
      return {
        id,
        name: stored.name,
        bg: `url("${stored.dataUrl}") center/cover no-repeat`,
        glows: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.12)'],
      };
    }
  }
  return PHONE_WALLPAPERS[0];
}

export function readLocalWallpaper(): string {
  if (typeof window === 'undefined') return DEFAULT_WALLPAPER_ID;
  try {
    // 一次性迁移：把旧版默认壁纸换成新的兔丸奶油主题
    if (window.localStorage.getItem(THEME_VERSION_KEY) !== THEME_VERSION) {
      window.localStorage.setItem(THEME_VERSION_KEY, THEME_VERSION);
      // 已经装了主题包时不要覆盖它的壁纸
      if (!readThemePackWallpaper()) window.localStorage.setItem(WALLPAPER_KEY, DEFAULT_WALLPAPER_ID);
    }
    const id = window.localStorage.getItem(WALLPAPER_KEY);
    if (id && PHONE_WALLPAPERS.some((w) => w.id === id)) return id;
    // 主题包壁纸（tp-<slug>）：只要主题包记录还在就保留
    if (id && id.startsWith('tp-') && readThemePackWallpaper()) return id;
    // 导入壁纸（mv-<素材id>）只要记录还在就保留，避免刷新后被重置
    if (id && id.startsWith('mv-')) {
      const stored = readImportedWallpaper();
      if (stored && `mv-${stored.id}` === id) return id;
    }
    return DEFAULT_WALLPAPER_ID;
  } catch {
    return DEFAULT_WALLPAPER_ID;
  }
}

export function writeLocalWallpaper(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WALLPAPER_KEY, id);
  } catch {
    // 隐私模式下忽略
  }
  window.dispatchEvent(new Event(WALLPAPER_EVENT));
}
