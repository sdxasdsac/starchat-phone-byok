// 移植自 ai-virtual-phone-main/components/icon-glyph.tsx（路径适配：@/lib/desktop-config → 本地 icons）
import type { IconId } from '@/components/phone/float-phone-icons';
import {
  mdiCompass,
  mdiCubeOutline,
  mdiDice5,
  mdiFlower,
  mdiGhost,
  mdiHeart,
  mdiLeaf,
  mdiLightningBolt,
  mdiPuzzle,
  mdiRocketLaunch,
  mdiStar,
  mdiTeddyBear,
  mdiCogOutline,
  mdiMessageProcessing,
  mdiBookOpenPageVariant,
  mdiMusic,
  mdiBookOpenVariant,
  mdiFeather,
  mdiMovie,
  mdiGamepadVariant,
  mdiPackageVariant,
  mdiCellphone,
  mdiShopping,
  mdiCalendarMonth,
  mdiMicrophone,
  mdiScriptTextOutline,
  mdiMapMarker,
  mdiEarth,
  mdiPlayCircle,
  mdiBookmark,
  mdiCamera,
  mdiAccountGroup,
  mdiPalette,
  mdiDatabase,
  mdiAccount,
  mdiHome,
  mdiBridge,
  mdiHammerWrench,
  mdiGlassCocktail,
  mdiStorefrontOutline,
  mdiWechat,
  mdiQqchat,
} from '@mdi/js';

type IconGlyphProps = {
  id: IconId;
  className?: string;
};

const MDI_PATHS: Record<IconId, string> = {
  wechat: mdiWechat,
  qq: mdiQqchat,
  settings: mdiCogOutline,
  chat: mdiMessageProcessing,
  diary: mdiBookOpenPageVariant,
  music: mdiMusic,
  reading: mdiBookOpenVariant,
  cocreate: mdiFeather,
  story: mdiMovie,
  game: mdiGamepadVariant,
  appmarket: mdiPackageVariant,
  xiaohongshu: mdiPackageVariant,
  checkphone: mdiCellphone,
  shopping: mdiShopping,
  calendar: mdiCalendarMonth,
  interview_magazine: mdiMicrophone,
  vnmode: mdiScriptTextOutline,
  mapmode: mdiMapMarker,
  worldbuilder: mdiEarth,
  qa: mdiHammerWrench,
  mixology: mdiGlassCocktail,
  vnplay: mdiPlayCircle,
  vnchapters: mdiBookmark,
  moments: mdiCamera,
  line: mdiMessageProcessing,
  group_chat: mdiAccountGroup,
  theme: mdiPalette,
  resources: mdiDatabase,
  resource_hub: mdiStorefrontOutline,
  characters: mdiAccount,
  dwelling: mdiHome,
  realitybridge: mdiBridge,
  // 应用市场可安装的应用
  phone: mdiCellphone,
  sms: mdiMessageProcessing,
  forum: mdiAccountGroup,
  inspiration: mdiLightningBolt,
  toy: mdiTeddyBear,
  shop: mdiShopping,
  memory: mdiCubeOutline,
  notes: mdiBookmark,
  anniversary: mdiHeart,
  douyin: mdiPlayCircle,
  market: mdiStorefrontOutline,
  backup: mdiDatabase,
  checkup: mdiHeart,
  album: mdiCamera,
  stats: mdiDatabase,
  favorites: mdiStar,
  widgetstudio: mdiPuzzle,
  room: mdiHome,
  scene: mdiMovie,
};

export function IconGlyph({ id, className }: IconGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d={MDI_PATHS[id] || 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z'}
        fill="var(--c-desktop-icon, #ffffff)"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
      />
    </svg>
  );
}

// ===== 无图标自定义 APP 的兜底字形 =====
const CUSTOM_APP_FALLBACK_PATHS = [
  mdiPuzzle,
  mdiHeart,
  mdiFlower,
  mdiRocketLaunch,
  mdiDice5,
  mdiCompass,
  mdiLightningBolt,
  mdiLeaf,
  mdiGhost,
  mdiStar,
  mdiCubeOutline,
  mdiTeddyBear,
];

export function customAppGlyphPath(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CUSTOM_APP_FALLBACK_PATHS[hash % CUSTOM_APP_FALLBACK_PATHS.length];
}

export function CustomAppGlyph({ seed, className }: { seed: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d={customAppGlyphPath(seed)}
        fill="var(--c-desktop-icon, #ffffff)"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
      />
    </svg>
  );
}
