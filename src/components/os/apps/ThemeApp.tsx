'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_WALLPAPER_ID,
  PHONE_WALLPAPERS,
  readLocalWallpaper,
  writeLocalWallpaper,
} from '@/lib/phone-theme';
import { applyThemePack, getThemePackSkin } from '@/lib/phone-theme-pack';
import { usePhone } from '../PhoneContext';
import { ICONS, Mdi, Screen } from '../ui';

type InstallPrompt = { prompt: () => Promise<void>; userChoice?: Promise<unknown> };

export function ThemeApp({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = usePhone();
  const [current, setCurrent] = useState(DEFAULT_WALLPAPER_ID);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setCurrent(readLocalWallpaper());
  }, []);

  const choose = (id: string) => {
    writeLocalWallpaper(id);
    setCurrent(id);
  };

  const install = async () => {
    const prompt = (window as unknown as { __spInstallPrompt?: InstallPrompt }).__spInstallPrompt;
    if (prompt) {
      await prompt.prompt();
      setInstalled(true);
      return;
    }
    window.alert(
      '当前浏览器没有提供安装入口。\n\niPhone：Safari 分享 → 添加到主屏幕。\nAndroid：浏览器菜单 → 安装应用 / 添加到主屏幕。',
    );
  };

  return (
    <Screen title="主题" subtitle="壁纸与桌面外观" onBack={onClose}>
      <h2 className="section-title">壁纸</h2>
      <div className="wallpaper-grid">
        {PHONE_WALLPAPERS.map((wp) => (
          <button
            key={wp.id}
            type="button"
            className={`wallpaper-tile${current === wp.id ? ' active' : ''}`}
            style={{ background: wp.bg }}
            onClick={() => choose(wp.id)}
          >
            <span>{wp.name}</span>
            {current === wp.id ? <Mdi path={ICONS.check} size={16} /> : null}
          </button>
        ))}
      </div>

      <h2 className="section-title">桌面</h2>
      <div className="settings-btn-row">
        <button
          type="button"
          className="soft-btn"
          onClick={() => {
            applyThemePack(null);
            window.alert('已恢复默认主题。长按桌面空白处可以进入编辑模式，拖动图标或组件。');
          }}
        >
          <Mdi path={ICONS.refresh} size={16} /> 恢复默认主题
        </button>
        <button type="button" className="soft-btn" onClick={() => void install()}>
          <Mdi path={ICONS.plus} size={16} /> 添加到主屏幕
        </button>
      </div>

      <div className="pwa-tip">
        <strong>桌面玩法</strong>
        <p>长按桌面空白处进入编辑：拖动图标换位置、跨页移动、把两个图标叠在一起建文件夹、添加时钟/日历组件。</p>
        <p>主题包皮肤：{getThemePackSkin('wechat') ? '已启用' : '未启用'}（可导入第三方主题包，本版先保留接口）。</p>
      </div>

      <div className="settings-btn-row">
        <button
          type="button"
          className="soft-btn"
          onClick={() => setSettings({ ...settings, autoRead: !settings.autoRead })}
        >
          <Mdi path={ICONS.volume} size={16} />
          自动朗读：{settings.autoRead ? '开' : '关'}
        </button>
        <button type="button" className="soft-btn" onClick={() => setInstalled(false)}>
          <Mdi path={ICONS.check} size={16} /> {installed ? '安装提示已弹出' : '安装状态未知'}
        </button>
      </div>
    </Screen>
  );
}
