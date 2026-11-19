'use client';

// 应用市场：读取 public/phone-apps/index.json，列出从 starchat 搬过来的全部插件。
// 插件是独立 HTML，点开即用；数据存在本机，AI 走用户自己的 API Key。
import { useEffect, useMemo, useState } from 'react';
import { mdiMagnify } from '@mdi/js';
import { usePhone } from '../PhoneContext';
import { EmptyState, Mdi, Screen, Spinner } from '../ui';
import { PhonePluginApp, type PluginMeta } from './PhonePluginApp';
import { assetPath } from '@/lib/base-path';

export function PluginMarketApp({ onClose }: { onClose: () => void }) {
  const { activePersona, settings } = usePhone();
  const [plugins, setPlugins] = useState<PluginMeta[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<PluginMeta | null>(null);

  useEffect(() => {
    fetch(assetPath('/phone-apps/index.json'), { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: unknown) =>
        setPlugins(
          Array.isArray(data)
            ? (data as PluginMeta[]).map((item) => ({
                ...item,
                entry: assetPath(item.entry),
                icon: assetPath(item.icon),
              }))
            : [],
        ),
      )
      .catch(() => setPlugins([]));
  }, []);

  const list = useMemo(() => {
    if (!plugins) return [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return plugins;
    return plugins.filter((p) =>
      `${p.name} ${p.description} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(keyword),
    );
  }, [plugins, query]);

  if (active) {
    return (
      <PhonePluginApp
        plugin={active}
        ctx={{
          convId: activePersona ? `conv_${activePersona.id}` : undefined,
          charId: activePersona?.id,
          charName: activePersona?.name,
          userName: settings.user.name,
          userAvatar: settings.user.avatar,
        }}
        onBack={() => setActive(null)}
      />
    );
  }

  return (
    <Screen title="应用市场" subtitle={plugins ? `${plugins.length} 个插件` : '正在读取…'} onBack={onClose}>
      <label className="plugin-search">
        <Mdi path={mdiMagnify} size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索插件、玩法或标签"
          aria-label="搜索插件"
        />
      </label>

      {plugins === null ? (
        <div className="plugin-loading">
          <Spinner size={20} />
          <span>正在加载插件…</span>
        </div>
      ) : list.length === 0 ? (
        <EmptyState title="没有找到插件" hint="换个关键词试试，或清空搜索查看全部。" />
      ) : (
        <div className="plugin-grid">
          {list.map((plugin) => (
            <button type="button" key={plugin.folder} className="plugin-card" onClick={() => setActive(plugin)}>
              <span className="plugin-icon">
                {plugin.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plugin.icon} alt="" loading="lazy" />
                ) : (
                  <span>{plugin.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="plugin-info">
                <span className="plugin-name">{plugin.name}</span>
                <span className="plugin-desc">{plugin.description || '暂无简介'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
