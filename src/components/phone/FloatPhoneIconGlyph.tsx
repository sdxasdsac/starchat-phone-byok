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
  mdiRobotOutline,
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
  douban: mdiBookOpenVariant,
  ai: mdiRobotOutline,
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

/** 微信官方绿色图标：绿色底 + 白色双气泡 */
const WECHAT_BG = 'linear-gradient(160deg,#41d97b 0%,#07c160 52%,#04a851 100%)';
/** LINE 官方绿色图标：绿色底 + 白色气泡 + 绿色 LINE 字样 */
const LINE_BG = 'linear-gradient(160deg,#3ad97f 0%,#06c755 55%,#04a948 100%)';

function LineBrandGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.4C6.4 2.4 2 5.9 2 10.3c0 3.3 2.5 6.2 6.2 7.2v2.8c0 .5.6.8 1 .5l3.1-2.4c4.4-.2 7.7-3.1 7.7-8.1 0-4.4-4.4-7.9-10-7.9Z"
        fill="#ffffff"
      />
      <text
        x="12"
        y="12.6"
        textAnchor="middle"
        fontSize="6.4"
        fontWeight="800"
        fontFamily="-apple-system, 'Helvetica Neue', Arial, sans-serif"
        fill="#06c755"
        letterSpacing="0.2"
      >
        LINE
      </text>
    </svg>
  );
}

export function IconGlyph({ id, className }: IconGlyphProps) {
  if (id === 'wechat' || id === 'qq') {
    return (
      <span className={`icon-brand${id === 'qq' ? ' icon-brand-line' : ''}`} style={{ background: id === 'qq' ? LINE_BG : WECHAT_BG }}>
        {id === 'qq' ? (
          <LineBrandGlyph className={className} />
        ) : (
          <svg viewBox="0 0 24 24" className={className} aria-hidden>
            <path d={mdiWechat} fill="#ffffff" />
          </svg>
        )}
      </span>
    );
  }
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
