'use client';

import { useMemo, useState } from 'react';
import type { Channel } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { ChatRoom } from '../ChatRoom';
import { Avatar, EmptyState, ICONS, Mdi, Screen } from '../ui';

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

/** 微信：会话列表 → 聊天 */
export function WeChatApp({ onClose, onOpenPersonas }: { onClose: () => void; onOpenPersonas: () => void }) {
  const { personas, messagesOf, activePersona } = usePhone();
  const [openId, setOpenId] = useState<string | null>(null);
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

  const rows = personas.map((p) => {
    const list = messagesOf('wechat', p.id);
    const last = list[list.length - 1];
    return { persona: p, last };
  });

  return (
    <Screen
      title="微信"
      onBack={onClose}
      className="wechat-list-screen"
      right={
        <button type="button" className="icon-btn-plain" onClick={onOpenPersonas} aria-label="新建角色">
          <Mdi path={ICONS.plus} size={20} />
        </button>
      }
    >
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
      {activePersona ? (
        <p className="list-foot">当前主角色：{activePersona.name}</p>
      ) : null}
    </Screen>
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
