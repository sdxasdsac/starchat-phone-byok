// 移植自 ai-virtual-phone-main/lib/desktop-config.ts（仅图标元信息与默认布局，逐字对照）
export type IconId =
  | 'wechat'
  | 'qq'
  | 'chat'
  | 'diary'
  | 'music'
  | 'reading'
  | 'cocreate'
  | 'story'
  | 'game'
  | 'appmarket'
  | 'xiaohongshu'
  | 'dwelling'
  | 'checkphone'
  | 'shopping'
  | 'calendar'
  | 'interview_magazine'
  | 'vnmode'
  | 'mapmode'
  | 'vnplay'
  | 'vnchapters'
  | 'moments'
  | 'line'
  | 'group_chat'
  | 'settings'
  | 'theme'
  | 'resources'
  | 'resource_hub'
  | 'characters'
  | 'worldbuilder'
  | 'realitybridge'
  | 'qa'
  | 'mixology'
  // 应用市场可安装到桌面的其余应用（首次安装才出现在桌面）
  | 'phone'
  | 'sms'
  | 'forum'
  | 'inspiration'
  | 'toy'
  | 'shop'
  | 'memory'
  | 'notes'
  | 'anniversary'
  | 'douyin'
  | 'market'
  | 'backup'
  | 'checkup'
  | 'album'
  | 'stats'
  | 'favorites'
  | 'widgetstudio'
  | 'room'
  | 'scene';

export type IconMeta = {
  id: IconId;
  label: string;
  tone: string;
  placeholder: boolean;
  path?: string;
};

export const PAGE_1_DEFAULT: IconId[] = ['wechat', 'qq', 'moments', 'xiaohongshu', 'appmarket', 'calendar'];

export const PAGE_2_DEFAULT: IconId[] = [
  'cocreate',
  'game',
  'appmarket',
  'xiaohongshu',
  'dwelling',
  'story',
  'vnmode',
  'mapmode',
];

export const PAGE_3_DEFAULT: IconId[] = ['worldbuilder', 'qa', 'resource_hub', 'realitybridge', 'mixology'];

export const DOCK_DEFAULT: IconId[] = ['chat', 'characters', 'theme', 'settings'];

export const ICONS: Record<IconId, IconMeta> = {
  wechat: { id: 'wechat', label: '微信', tone: 'var(--c-icon-green)', placeholder: false },
  qq: { id: 'qq', label: 'LINE', tone: 'var(--c-icon-green)', placeholder: false },
  chat: { id: 'chat', label: '聊天', tone: 'var(--c-icon-green)', placeholder: false },
  diary: { id: 'diary', label: '手记', tone: 'var(--c-icon-violet)', placeholder: false },
  music: { id: 'music', label: '音乐', tone: 'var(--c-icon-coral)', placeholder: false },
  reading: { id: 'reading', label: '阅读', tone: 'var(--c-icon-amber)', placeholder: false },
  cocreate: { id: 'cocreate', label: '共创', tone: 'var(--c-icon-cocreate, #c8b58a)', placeholder: false },
  story: { id: 'story', label: '剧情', tone: 'var(--c-icon-story, #8b6f52)', placeholder: false },
  game: { id: 'game', label: '游戏', tone: 'var(--c-icon-blue)', placeholder: false },
  appmarket: { id: 'appmarket', label: '应用市场', tone: 'var(--c-icon-teal)', placeholder: false },
  xiaohongshu: { id: 'xiaohongshu', label: '小红薯', tone: 'var(--c-icon-rose)', placeholder: false },
  checkphone: { id: 'checkphone', label: '查手机', tone: 'var(--c-icon-slate)', placeholder: false },
  dwelling: { id: 'dwelling', label: '栖所', tone: 'var(--c-icon-rose)', placeholder: false },
  shopping: { id: 'shopping', label: '购物', tone: 'var(--c-icon-amber)', placeholder: false },
  calendar: { id: 'calendar', label: '日历', tone: 'var(--c-icon-rose)', placeholder: true },
  interview_magazine: { id: 'interview_magazine', label: '在场', tone: 'var(--c-icon-lilac)', placeholder: false },
  vnmode: { id: 'vnmode', label: '漫卷', tone: 'var(--c-icon-rose)', placeholder: false },
  mapmode: { id: 'mapmode', label: '冒险', tone: 'var(--c-icon-amber)', placeholder: false },
  vnplay: { id: 'vnplay', label: '漫卷播放', tone: 'var(--c-icon-rose)', placeholder: true },
  vnchapters: { id: 'vnchapters', label: '章节', tone: 'var(--c-icon-rose)', placeholder: true },
  moments: { id: 'moments', label: '朋友圈', tone: 'var(--c-icon-lilac)', placeholder: false },
  line: { id: 'line', label: 'LINE', tone: 'var(--c-icon-green)', placeholder: false },
  group_chat: { id: 'group_chat', label: '群聊', tone: 'var(--c-icon-teal)', placeholder: false },
  realitybridge: { id: 'realitybridge', label: '现实来信', tone: 'var(--c-icon-teal)', placeholder: false },
  settings: { id: 'settings', label: '设置', tone: 'var(--c-icon-slate)', placeholder: false },
  theme: { id: 'theme', label: '主题', tone: 'var(--c-icon-violet)', placeholder: true },
  resources: { id: 'resources', label: '资源库', tone: 'var(--c-icon-teal)', placeholder: false },
  resource_hub: { id: 'resource_hub', label: '素材仓库', tone: 'var(--c-icon-amber)', placeholder: false },
  characters: { id: 'characters', label: '角色库', tone: 'var(--c-icon-lilac)', placeholder: false },
  worldbuilder: { id: 'worldbuilder', label: '筑境', tone: 'var(--c-icon-amber)', placeholder: false, path: '/world-builder' },
  qa: { id: 'qa', label: '工坊', tone: 'var(--c-icon-qa, #4a505c99)', placeholder: false },
  mixology: { id: 'mixology', label: '角色库', tone: 'var(--c-icon-violet)', placeholder: false },
  // 应用市场可安装的应用
  phone: { id: 'phone', label: '电话', tone: 'var(--c-icon-green)', placeholder: false },
  sms: { id: 'sms', label: '信息', tone: 'var(--c-icon-green)', placeholder: false },
  forum: { id: 'forum', label: '论坛', tone: 'var(--c-icon-blue)', placeholder: false },
  inspiration: { id: 'inspiration', label: '灵感', tone: 'var(--c-icon-lilac)', placeholder: false },
  toy: { id: 'toy', label: '亲密', tone: 'var(--c-icon-rose)', placeholder: false },
  shop: { id: 'shop', label: '星语', tone: 'var(--c-icon-amber)', placeholder: false },
  memory: { id: 'memory', label: '记忆', tone: 'var(--c-icon-violet)', placeholder: false },
  notes: { id: 'notes', label: '便签', tone: 'var(--c-icon-amber)', placeholder: false },
  anniversary: { id: 'anniversary', label: '纪念日', tone: 'var(--c-icon-rose)', placeholder: false },
  douyin: { id: 'douyin', label: '抖音', tone: 'var(--c-icon-slate)', placeholder: false },
  market: { id: 'market', label: '黑市', tone: 'var(--c-icon-slate)', placeholder: false },
  backup: { id: 'backup', label: '备份', tone: 'var(--c-icon-slate)', placeholder: false },
  checkup: { id: 'checkup', label: '体检', tone: 'var(--c-icon-teal)', placeholder: false },
  album: { id: 'album', label: '相册', tone: 'var(--c-icon-coral)', placeholder: false },
  stats: { id: 'stats', label: '数据', tone: 'var(--c-icon-blue)', placeholder: false },
  favorites: { id: 'favorites', label: '收藏', tone: 'var(--c-icon-amber)', placeholder: false },
  widgetstudio: { id: 'widgetstudio', label: '小组件', tone: 'var(--c-icon-amber)', placeholder: false },
  room: { id: 'room', label: '布置', tone: 'var(--c-icon-coral)', placeholder: false },
  scene: { id: 'scene', label: '场景', tone: 'var(--c-icon-slate)', placeholder: false },
};

// ── 桌面文件夹（源 lib/desktop-config.ts + desktop-layout-storage.ts）──
// 文件夹以 folder: 前缀的 id 伪装成图标占格子参与拖拽/换页，内容另存 DesktopFolderMap。
export type FolderIconId = `folder:${string}`;
export type DesktopIconId = IconId | FolderIconId;
export type DesktopFolder = { name: string; icons: DesktopIconId[] };
export type DesktopFolderMap = Record<string, DesktopFolder>;
/** 桌面格子上的图标（1 基行列），源 lib/desktop-config.ts 同名类型 */
export type IconPosition = { id: DesktopIconId; row: number; col: number };
export type DesktopLayout = Record<string, IconPosition[]>;

export function isFolderIconId(id: string): id is FolderIconId {
  return id.startsWith('folder:');
}

export function createFolderIconId(): FolderIconId {
  return `folder:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

