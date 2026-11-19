'use client';

import { useMemo, useState } from 'react';
import {
  mdiMessageTextOutline,
  mdiAccountMultipleOutline,
  mdiCompassOutline,
  mdiAccountOutline,
  mdiChevronRight,
  mdiCameraOutline,
  mdiAccountPlusOutline,
  mdiCogOutline,
  mdiPaletteOutline,
} from '@mdi/js';
import type { Channel } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { ChatRoom } from '../ChatRoom';
import { Avatar, EmptyState, ICONS, Mdi, Screen } from '../ui';
import { MomentsApp } from './MomentsApp';

function lastPreview(text: string | undefined): string {
  if (!text) return '开始聊天吧';
  return text.replace(/\s+/g, ' ').slice(0, 30);
}

function formatWhen(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/** 主聊天 App：顶部切换角色，下面是通用聊天室 */
export function ChatApp({ onClose, onOpenPersonas }: { onClose: () => void; onOpenPersonas: () => void }) {
  const { personas, activePersona, setActivePersonaId } = usePhone();
  const persona = activePersona;

  if (!persona) {
    return (
      <Screen title="聊天" onBack={onClose}>
        <EmptyState
          title="还没有角色"
          hint="先创建一个人设，再开始聊天"
          action={
            <button type="button" className="primary-btn" onClick={onOpenPersonas}>
              去创建人设
            </button>
          }
        />
      </Screen>
    );
  }

  return (
    <section className="app-screen chat-app">
      {personas.length > 1 ? (
        <div className="persona-switcher">
          <div className="persona-chips">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`persona-chip${p.id === persona.id ? ' active' : ''}`}
                onClick={() => setActivePersonaId(p.id)}
              >
                <Avatar persona={p} size={24} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn-plain" onClick={onOpenPersonas} aria-label="管理人设">
            <Mdi path={ICONS.plus} size={20} />
          </button>
        </div>
      ) : null}
      <ChatRoom key={persona.id} persona={persona} channel="chat" variant="chat" onBack={onClose} />
    </section>
  );
}

/** 微信：底部四栏（微信 / 通讯录 / 发现 / 我）+ 会话列表 + 聊天 */
export function WeChatApp({
  onClose,
  onOpenPersonas,
  onOpenSettings,
  onOpenTheme,
}: {
  onClose: () => void;
  onOpenPersonas: () => void;
  onOpenSettings: () => void;
  onOpenTheme: () => void;
}) {
  const { personas, messagesOf, settings } = usePhone();
  const [tab, setTab] = useState<'chats' | 'contacts' | 'discover' | 'me'>('chats');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMoments, setShowMoments] = useState(false);
  const openPersona = personas.find((p) => p.id === openId) ?? null;

  if (openPersona) {
    return (
      <ChatRoom
        key={`wechat_${openPersona.id}`}
        persona={openPersona}
        channel={'wechat' as Channel}
        variant="wechat"
        onBack={() => setOpenId(null)}
      />
    );
  }

  if (showMoments) {
    return <MomentsApp onClose={() => setShowMoments(false)} />;
  }

  const rows = personas.map((p) => {
    const list = messagesOf('wechat', p.id);
    const last = list[list.length - 1];
    return { persona: p, last };
  });

  const titles: Record<typeof tab, string> = {
    chats: '微信',
    contacts: '通讯录',
    discover: '发现',
    me: '我',
  };

  return (
    <section className="app-screen wechat-app">
      <header className="app-header wechat-head">
        <button type="button" className="app-back" onClick={onClose} aria-label="返回桌面">
          <span className="wechat-chevron">‹</span>
        </button>
        <div className="app-title-wrap">
          <h1>{titles[tab]}</h1>
        </div>
        <div className="app-header-right">
          {tab === 'chats' || tab === 'contacts' ? (
            <button type="button" className="icon-btn-plain" onClick={onOpenPersonas} aria-label="新建角色">
              <Mdi path={ICONS.plus} size={20} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="app-body wechat-tab-body">
        {tab === 'chats' ? (
          <>
            <div className="wechat-search">搜索</div>
            <div className="conv-list">
              {rows.map(({ persona, last }) => (
                <button key={persona.id} type="button" className="conv-row" onClick={() => setOpenId(persona.id)}>
                  <Avatar persona={persona} size={46} />
                  <div className="conv-main">
                    <div className="conv-top">
                      <span className="conv-name">{persona.name}</span>
                      <span className="conv-time">{last ? formatWhen(last.createdAt) : ''}</span>
                    </div>
                    <div className="conv-preview">{lastPreview(last?.text)}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'contacts' ? (
          <div className="wx-cell-group">
            <button type="button" className="wx-cell" onClick={() => setShowMoments(true)}>
              <span className="wx-cell-icon wx-icon-green">
                <Mdi path={mdiAccountMultipleOutline} size={20} />
              </span>
              <span className="wx-cell-text">朋友圈</span>
              <Mdi path={mdiChevronRight} size={18} />
            </button>
            {personas.map((p) => (
              <button key={p.id} type="button" className="wx-cell" onClick={() => setOpenId(p.id)}>
                <Avatar persona={p} size={36} />
                <span className="wx-cell-text">{p.name}</span>
                <Mdi path={mdiChevronRight} size={18} />
              </button>
            ))}
            <button type="button" className="wx-cell wx-cell-center" onClick={onOpenPersonas}>
              新建角色
            </button>
          </div>
        ) : null}

        {tab === 'discover' ? (
          <div className="wx-cell-group">
            <button type="button" className="wx-cell" onClick={() => setShowMoments(true)}>
              <span className="wx-cell-icon">
                <Mdi path={mdiCameraOutline} size={20} />
              </span>
              <span className="wx-cell-text">朋友圈</span>
              <span className="wx-cell-badge">{personas.length}</span>
              <Mdi path={mdiChevronRight} size={18} />
            </button>
            <button type="button" className="wx-cell" onClick={onOpenPersonas}>
              <span className="wx-cell-icon">
                <Mdi path={mdiAccountPlusOutline} size={20} />
              </span>
              <span className="wx-cell-text">添加角色</span>
              <Mdi path={mdiChevronRight} size={18} />
            </button>
          </div>
        ) : null}

        {tab === 'me' ? (
          <>
            <div className="wx-me-card">
              <Avatar name={settings.user.name || '我'} avatar={settings.user.avatar} size={58} />
              <div>
                <div className="wx-me-name">{settings.user.name || '我'}</div>
                <div className="wx-me-id">微信号：sp_{settings.user.name ? 'me' : 'guest'}</div>
              </div>
            </div>
            <div className="wx-cell-group">
              <button type="button" className="wx-cell" onClick={onOpenSettings}>
                <span className="wx-cell-icon">
                  <Mdi path={mdiCogOutline} size={20} />
                </span>
                <span className="wx-cell-text">设置</span>
                <Mdi path={mdiChevronRight} size={18} />
              </button>
              <button type="button" className="wx-cell" onClick={onOpenTheme}>
                <span className="wx-cell-icon">
                  <Mdi path={mdiPaletteOutline} size={20} />
                </span>
                <span className="wx-cell-text">主题与壁纸</span>
                <Mdi path={mdiChevronRight} size={18} />
              </button>
            </div>
          </>
        ) : null}
      </div>

      <nav className="wechat-tabbar">
        {(
          [
            ['chats', '微信', mdiMessageTextOutline],
            ['contacts', '通讯录', mdiAccountMultipleOutline],
            ['discover', '发现', mdiCompassOutline],
            ['me', '我', mdiAccountOutline],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            className={`wechat-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Mdi path={icon} size={23} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

/** LINE：绿色主题的会话列表 + 聊天 */
export function LineApp({ onClose, onOpenPersonas }: { onClose: () => void; onOpenPersonas: () => void }) {
  const { personas, messagesOf } = usePhone();
  const [openId, setOpenId] = useState<string | null>(null);
  const openPersona = personas.find((p) => p.id === openId) ?? null;

  const rows = useMemo(
    () =>
      personas.map((p) => {
        const list = messagesOf('line', p.id);
        return { persona: p, last: list[list.length - 1] };
      }),
    [messagesOf, personas],
  );

  if (openPersona) {
    return (
      <ChatRoom
        key={`line_${openPersona.id}`}
        persona={openPersona}
        channel={'line' as Channel}
        variant="line"
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <Screen
      title="LINE"
      onBack={onClose}
      className="line-list-screen"
      right={
        <button type="button" className="icon-btn-plain" onClick={onOpenPersonas} aria-label="新建角色">
          <Mdi path={ICONS.plus} size={20} />
        </button>
      }
    >
      <div className="line-hero">
        <span>LINE</span>
        <p>和角色保持联系</p>
      </div>
      <div className="conv-list">
        {rows.map(({ persona, last }) => (
          <button key={persona.id} type="button" className="conv-row line" onClick={() => setOpenId(persona.id)}>
            <Avatar persona={persona} size={46} />
            <div className="conv-main">
              <div className="conv-top">
                <span className="conv-name">{persona.name}</span>
                <span className="conv-time">{last ? formatWhen(last.createdAt) : ''}</span>
              </div>
              <div className="conv-preview">{lastPreview(last?.text)}</div>
            </div>
          </button>
        ))}
      </div>
    </Screen>
  );
}
