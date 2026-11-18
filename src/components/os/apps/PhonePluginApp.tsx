'use client';

// 小手机插件容器：插件是自带 index.html 的独立页面，用 iframe 打开。
// iframe 里由 /phone-apps/ai-phone-host.js（已改成 BYOK 本地适配版）提供 window.AiPhone，
// 角色、钱包、聊天、AI 全部落在本机 localStorage / 用户自己的 API Key 上。
import { useEffect, useMemo, useRef, useState } from 'react';
import { mdiArrowLeft } from '@mdi/js';
import { Mdi } from '../ui';

export type PluginMeta = {
  folder: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  entry: string;
  tags?: string[];
};

export type PluginCtx = {
  convId?: string;
  charId?: string;
  charName?: string;
  userName?: string;
  userAvatar?: string;
};

export function PhonePluginApp({
  plugin,
  ctx,
  onBack,
}: {
  plugin: PluginMeta;
  ctx?: PluginCtx;
  onBack: () => void;
}) {
  const [toast, setToast] = useState('');
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const src = useMemo(() => {
    const query = new URLSearchParams();
    query.set('appId', plugin.folder);
    if (ctx?.convId) query.set('convId', ctx.convId);
    if (ctx?.charId) query.set('charId', ctx.charId);
    if (ctx?.charName) query.set('charName', ctx.charName);
    if (ctx?.userName) query.set('userName', ctx.userName);
    if (ctx?.userAvatar) query.set('userAvatar', ctx.userAvatar);
    return `${plugin.entry}?${query.toString()}`;
  }, [plugin.entry, plugin.folder, ctx?.convId, ctx?.charId, ctx?.charName, ctx?.userName, ctx?.userAvatar]);

  // 插件的 app.close() / ui.toast() 通过 postMessage 回来
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as { source?: string; type?: string; message?: string } | null;
      if (!data || data.source !== 'starchat-phone-app') return;
      if (data.type === 'close') onBack();
      else if (data.type === 'toast' && data.message) {
        setToast(data.message);
        window.setTimeout(() => setToast(''), 2200);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onBack]);

  return (
    <section className="plugin-app">
      <header className="plugin-topbar">
        <button type="button" className="plugin-back" onClick={onBack} aria-label="返回应用市场">
          <Mdi path={mdiArrowLeft} size={22} />
        </button>
        <span className="plugin-title">{plugin.name}</span>
        <span className="plugin-version">v{plugin.version}</span>
      </header>
      <iframe
        key={plugin.folder}
        ref={frameRef}
        src={src}
        title={plugin.name}
        className="plugin-frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads allow-top-navigation-by-user-activation"
      />
      {toast ? <div className="plugin-toast">{toast}</div> : null}
    </section>
  );
}
