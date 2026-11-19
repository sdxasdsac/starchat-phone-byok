'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FloatPhoneShell } from '@/components/phone/FloatPhoneShell';
import { FloatPhoneDesktop } from '@/components/phone/FloatPhoneDesktop';
import { PAGE_1_DEFAULT, PAGE_DAILY_DEFAULT, type IconId } from '@/components/phone/float-phone-icons';
import { PhoneProvider, usePhone } from './PhoneContext';
import { AccessGate } from './AccessGate';
import { isUnlocked } from '@/lib/access';
import { applyThemePack, applyThemePackStyles, readActiveThemePack, DEFAULT_THEME_PACK } from '@/lib/phone-theme-pack';
import { ChatApp, LineApp, WeChatApp } from './apps/ChatApps';
import { PersonaApp } from './apps/PersonaApp';
import { SettingsApp } from './apps/SettingsApp';
import { ThemeApp } from './apps/ThemeApp';
import { MomentsApp } from './apps/MomentsApp';
import { XhsApp } from './apps/XhsApp';
import { PluginMarketApp } from './apps/PluginMarketApp';
import { MusicApp } from './apps/MusicApp';
import { DiaryApp } from './apps/DiaryApp';
import { ReadingApp } from './apps/ReadingApp';
import { AnniversaryApp } from './apps/AnniversaryApp';
import { AlbumApp } from './apps/AlbumApp';
import { DoubanApp } from './apps/DoubanApp';
import { AiAssistantApp } from './apps/AiAssistantApp';
import { PhoneCalendarApp } from '@/components/phone/apps/calendar/PhoneCalendarApp';
import { ICONS, Mdi, Screen } from './ui';

type AppId =
  | 'chat'
  | 'wechat'
  | 'line'
  | 'moments'
  | 'xhs'
  | 'personas'
  | 'settings'
  | 'theme'
  | 'calendar'
  | 'plugins'
  | 'music'
  | 'diary'
  | 'reading'
  | 'anniversary'
  | 'album'
  | 'douban'
  | 'ai'
  | 'unknown';

const ICON_TO_APP: Partial<Record<IconId, AppId>> = {
  chat: 'chat',
  wechat: 'wechat',
  qq: 'line',
  moments: 'moments',
  xiaohongshu: 'xhs',
  characters: 'personas',
  settings: 'settings',
  theme: 'theme',
  calendar: 'calendar',
  appmarket: 'plugins',
  music: 'music',
  diary: 'diary',
  reading: 'reading',
  anniversary: 'anniversary',
  album: 'album',
  douban: 'douban',
  ai: 'ai',
};

export function PhoneOS() {
  return (
    <PhoneProvider>
      <PhoneShell />
    </PhoneProvider>
  );
}

function PhoneShell() {
  const { ready, settings, personas } = usePhone();
  const [app, setApp] = useState<AppId | null>(null);
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [displayMode, setDisplayMode] = useState<string | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUnlocked(isUnlocked());
  }, []);

  // 默认美化：黑白熊（首次打开自动应用一次，之后跟随用户在「主题」里的选择）
  useEffect(() => {
    const SEED_KEY = 'sp.themePack.bear.v1';
    try {
      if (!window.localStorage.getItem(SEED_KEY)) {
        applyThemePack(DEFAULT_THEME_PACK);
        window.localStorage.setItem(SEED_KEY, '1');
      } else {
        applyThemePackStyles(readActiveThemePack());
      }
    } catch {
      // 隐私模式忽略
    }
  }, []);

  const calendarOwners = useMemo(
    () => [
      {
        key: 'user:me',
        ownerType: 'user' as const,
        ownerId: 'self',
        name: settings.user.name || '我',
        avatar: settings.user.avatar || null,
      },
      ...personas.map((persona) => ({
        key: `character:${persona.id}`,
        ownerType: 'character' as const,
        ownerId: persona.id,
        name: persona.name,
        avatar: persona.avatar || null,
      })),
    ],
    [personas, settings.user.name, settings.user.avatar],
  );

  const periodCareCharacters = useMemo(
    () => personas.map((persona) => ({ characterId: persona.id, name: persona.name, avatar: persona.avatar || null })),
    [personas],
  );

  // 只有装到桌面（standalone）时才隐藏模拟状态栏、改用系统安全区
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const apply = () => setDisplayMode(mq.matches ? 'standalone' : undefined);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // 桌面端按视口高度等比缩放整台手机；移动端由 CSS 全屏接管
  useEffect(() => {
    const fit = () => {
      const root = rootRef.current;
      if (!root) return;
      const wrap = root.querySelector('.phone-shell-wrap') as HTMLElement | null;
      if (!wrap) return;
      wrap.style.transform = 'none';
      const naturalHeight = wrap.offsetHeight;
      wrap.style.transform = '';
      if (!naturalHeight) return;
      const scale = Math.min(1, (window.innerHeight - 20) / naturalHeight);
      root.style.setProperty('--os-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const open = (id: IconId) => setApp(ICON_TO_APP[id] ?? 'unknown');
  const close = () => setApp(null);

  return (
    <div className="fp-root os-root" data-pwa-display-mode={displayMode} ref={rootRef}>
      <main className="app-root">
        <FloatPhoneShell>
          {unlocked === null ? null : !unlocked ? (
            <AccessGate onUnlock={() => setUnlocked(true)} />
          ) : (
            <>
          <FloatPhoneDesktop pages={[PAGE_1_DEFAULT, PAGE_DAILY_DEFAULT]} onOpen={open} />

          {ready && !settings.text.apiKey.trim() && !app ? (
            <button type="button" className="setup-banner" onClick={() => setApp('settings')}>
              <Mdi path={ICONS.refresh} size={16} />
              首次使用：先填文字 API Key
            </button>
          ) : null}

          {app ? (
            <div className={`app-overlay app-${app}`}>
              {app === 'chat' ? (
                <ChatApp onClose={close} onOpenPersonas={() => setApp('personas')} />
              ) : null}
              {app === 'wechat' ? (
                <WeChatApp
                  onClose={close}
                  onOpenPersonas={() => setApp('personas')}
                  onOpenSettings={() => setApp('settings')}
                  onOpenTheme={() => setApp('theme')}
                />
              ) : null}
              {app === 'line' ? (
                <LineApp onClose={close} onOpenPersonas={() => setApp('personas')} />
              ) : null}
              {app === 'moments' ? <MomentsApp onClose={close} /> : null}
              {app === 'xhs' ? <XhsApp onClose={close} /> : null}
              {app === 'personas' ? <PersonaApp onClose={close} /> : null}
              {app === 'settings' ? <SettingsApp onClose={close} /> : null}
              {app === 'theme' ? <ThemeApp onClose={close} /> : null}
              {app === 'plugins' ? <PluginMarketApp onClose={close} /> : null}
              {app === 'music' ? <MusicApp onClose={close} /> : null}
              {app === 'diary' ? <DiaryApp onClose={close} /> : null}
              {app === 'reading' ? <ReadingApp onClose={close} /> : null}
              {app === 'anniversary' ? <AnniversaryApp onClose={close} /> : null}
              {app === 'album' ? <AlbumApp onClose={close} /> : null}
              {app === 'douban' ? <DoubanApp onClose={close} /> : null}
              {app === 'ai' ? <AiAssistantApp onClose={close} /> : null}
              {app === 'calendar' ? (
                <PhoneCalendarApp
                  onClose={close}
                  owners={calendarOwners}
                  periodCareCharacters={periodCareCharacters}
                />
              ) : null}
              {app === 'unknown' ? (
                <Screen title="这个 App 还没接入" onBack={close}>
                  <div className="empty-state">
                    <Mdi path={ICONS.spark} size={30} />
                    <p className="empty-title">先把聊天、人设、朋友圈、小红薯跑通</p>
                    <p className="empty-hint">其余桌面图标是保留位，后续可以按同一套结构继续接。</p>
                  </div>
                </Screen>
              ) : null}
            </div>
          ) : null}
            </>
          )}
        </FloatPhoneShell>
      </main>
    </div>
  );
}
