'use client';

import { useMemo, useState } from 'react';
import {
  mdiAccountMultipleOutline,
  mdiChatOutline,
  mdiCompassOutline,
  mdiPlus,
  mdiThumbUpOutline,
  mdiChevronRight,
  mdiDeleteOutline,
} from '@mdi/js';
import type { ChatMessage, Group } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { ChatRoom } from '../ChatRoom';
import { MediaImage } from '../ChatRoom';
import { chatComplete } from '@/lib/api';
import { uid } from '@/lib/store';
import { Avatar, EmptyState, ErrorNote, ICONS, Mdi, Spinner } from '../ui';

function when(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/** 真 QQ：蓝色皮肤会话 + 联系人 + QQ空间动态 */
export function QqApp({ onClose, onOpenPersonas }: { onClose: () => void; onOpenPersonas: () => void }) {
  const { personas, messagesOf, moments } = usePhone();
  const [tab, setTab] = useState<'chats' | 'contacts' | 'zone'>('chats');
  const [openId, setOpenId] = useState<string | null>(null);
  const openPersona = personas.find((p) => p.id === openId) ?? null;

  const zone = useMemo(() => [...moments].sort((a, b) => b.createdAt - a.createdAt), [moments]);

  if (openPersona) {
    return (
      <section className="qq-app">
        <ChatRoom
          key={`qq_${openPersona.id}`}
          persona={openPersona}
          channel="qq"
          variant="qq"
          onBack={() => setOpenId(null)}
        />
      </section>
    );
  }

  return (
    <section className="app-screen qq-app">
      <header className="qq-head">
        <button type="button" className="app-back qq-back" onClick={onClose} aria-label="返回桌面">
          <Mdi path={ICONS.close} size={20} />
        </button>
        <h1>
          {tab === 'chats' ? '消息' : tab === 'contacts' ? '联系人' : 'QQ空间'}
        </h1>
        <button type="button" className="qq-head-btn" onClick={onOpenPersonas} aria-label="新建角色">
          <Mdi path={mdiPlus} size={20} />
        </button>
      </header>

      <div className="app-body qq-body">
        {tab === 'chats' ? (
          <div className="qq-list">
            {personas.map((p) => {
              const list = messagesOf('qq', p.id);
              const last = list[list.length - 1];
              return (
                <button key={p.id} type="button" className="qq-row" onClick={() => setOpenId(p.id)}>
                  <Avatar persona={p} size={46} />
                  <div className="qq-row-main">
                    <div className="qq-row-top">
                      <span className="qq-row-name">{p.name}</span>
                      <span className="qq-row-time">{last ? when(last.createdAt) : ''}</span>
                    </div>
                    <div className="qq-row-preview">
                      {last?.text ? last.text.replace(/\s+/g, ' ').slice(0, 28) : '开始聊天吧'}
                    </div>
                  </div>
                </button>
              );
            })}
            {personas.length === 0 ? (
              <EmptyState title="还没有好友" hint="先创建一个角色" action={<button type="button" className="primary-btn" onClick={onOpenPersonas}>去创建</button>} />
            ) : null}
          </div>
        ) : null}

        {tab === 'contacts' ? (
          <div className="qq-list">
            <div className="qq-section">我的好友</div>
            {personas.map((p) => (
              <button key={p.id} type="button" className="qq-row compact" onClick={() => setOpenId(p.id)}>
                <Avatar persona={p} size={38} />
                <span className="qq-row-name">{p.name}</span>
                <Mdi path={mdiChevronRight} size={18} />
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'zone' ? (
          <div className="qz-feed">
            {zone.length === 0 ? (
              <EmptyState title="空间还没有动态" hint="去朋友圈生成几条，会同步显示在这里" />
            ) : (
              zone.map((post) => (
                <article key={post.id} className="qz-card">
                  <div className="qz-head">
                    <Avatar name={post.authorName} avatar={post.authorAvatar} size={36} />
                    <div>
                      <div className="qz-name">{post.authorName}</div>
                      <div className="qz-time">{when(post.createdAt)}</div>
                    </div>
                  </div>
                  <p className="qz-text">{post.text}</p>
                  {post.photoId || post.photoUrl ? <MediaImage imageId={post.photoId} imageUrl={post.photoUrl} /> : null}
                  <div className="qz-actions">
                    <span>
                      <Mdi path={mdiThumbUpOutline} size={15} /> {post.likes.length}
                    </span>
                    <span>
                      <Mdi path={mdiChatOutline} size={15} /> {post.comments.length}
                    </span>
                  </div>
                  {post.comments.slice(-3).map((c) => (
                    <div key={c.id} className="qz-comment">
                      <b>{c.author}</b>：{c.text}
                    </div>
                  ))}
                </article>
              ))
            )}
          </div>
        ) : null}
      </div>

      <nav className="qq-tabbar">
        {(
          [
            ['chats', mdiChatOutline],
            ['contacts', mdiAccountMultipleOutline],
            ['zone', mdiCompassOutline],
          ] as const
        ).map(([key, icon]) => (
          <button
            key={key}
            type="button"
            className={`qq-tab${tab === key ? ' on' : ''}`}
            onClick={() => setTab(key)}
            aria-label={key}
          >
            <Mdi path={icon} size={24} />
          </button>
        ))}
      </nav>
    </section>
  );
}

/** 群聊列表 + 建群 */
export function GroupApp({ onClose, onOpenPersonas }: { onClose: () => void; onOpenPersonas: () => void }) {
  const { groups, personas, upsertGroup, deleteGroup, messagesOf } = usePhone();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const openGroup = groups.find((g) => g.id === openId) ?? null;

  if (openGroup) {
    return <GroupRoom group={openGroup} onBack={() => setOpenId(null)} />;
  }

  const create = () => {
    const members = picked.length ? picked : personas.slice(0, 3).map((p) => p.id);
    if (!members.length) return;
    const group: Group = {
      id: uid('g_'),
      name: name.trim() || '新的群聊',
      memberIds: members,
      createdAt: Date.now(),
    };
    upsertGroup(group);
    setCreating(false);
    setName('');
    setPicked([]);
    setOpenId(group.id);
  };

  return (
    <section className="app-screen group-app">
      <header className="app-header">
        <button type="button" className="app-back" onClick={onClose} aria-label="返回桌面">
          <Mdi path={ICONS.close} size={20} />
        </button>
        <div className="app-title-wrap">
          <h1>群聊</h1>
        </div>
        <div className="app-header-right">
          <button type="button" className="icon-btn-plain" onClick={() => setCreating(true)} aria-label="建群">
            <Mdi path={mdiPlus} size={20} />
          </button>
        </div>
      </header>
      <div className="app-body group-body">
        {groups.length === 0 ? (
          <EmptyState
            title="还没有群聊"
            hint="把几个角色拉进一个群，让他们自己聊起来"
            action={
              <button type="button" className="primary-btn" onClick={() => setCreating(true)}>
                创建群聊
              </button>
            }
          />
        ) : (
          groups.map((g) => {
            const list = messagesOf('group', g.id);
            const last = list[list.length - 1];
            const members = personas.filter((p) => g.memberIds.includes(p.id));
            return (
              <div key={g.id} className="group-row-wrap">
                <button type="button" className="group-row" onClick={() => setOpenId(g.id)}>
                  <span className="group-avatar">
                    {members.slice(0, 3).map((m) => (
                      <Avatar key={m.id} persona={m} size={22} />
                    ))}
                  </span>
                  <div className="group-row-main">
                    <div className="group-row-name">
                      {g.name}
                      <span className="group-count">{members.length}人</span>
                    </div>
                    <div className="group-row-preview">
                      {last ? `${last.senderName || (last.role === 'user' ? '我' : '群友')}：${last.text}`.slice(0, 26) : '打个招呼吧'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="group-del"
                  onClick={() => deleteGroup(g.id)}
                  aria-label="删除群聊"
                >
                  <Mdi path={mdiDeleteOutline} size={18} />
                </button>
              </div>
            );
          })
        )}
        {personas.length < 2 ? (
          <div className="group-tip">
            至少需要两个角色才能建群
            <button type="button" className="link-btn" onClick={onOpenPersonas}>
              去创建角色
            </button>
          </div>
        ) : null}
      </div>

      {creating ? (
        <div className="sheet-mask" onClick={() => setCreating(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">
              <span>创建群聊</span>
              <button type="button" className="icon-btn-plain" onClick={() => setCreating(false)}>
                <Mdi path={ICONS.close} size={18} />
              </button>
            </div>
            <input
              className="sheet-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="群名称，例如 深夜吐槽群"
            />
            <div className="group-pick">
              {personas.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`group-pick-row${on ? ' on' : ''}`}
                    onClick={() =>
                      setPicked((prev) => (on ? prev.filter((id) => id !== p.id) : [...prev, p.id]))
                    }
                  >
                    <Avatar persona={p} size={30} />
                    <span>{p.name}</span>
                    <span className="group-check">{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="primary-btn" onClick={create}>
              创建
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** 群聊房间：多角色轮流回复 */
function GroupRoom({ group, onBack }: { group: Group; onBack: () => void }) {
  const { personas, settings, messagesOf, appendMessage, clearConversation } = usePhone();
  const members = useMemo(
    () => personas.filter((p) => group.memberIds.includes(p.id)),
    [group.memberIds, personas],
  );
  const messages = messagesOf('group', group.id);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const [speakingName, setSpeakingName] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    const userMessage: ChatMessage = {
      id: uid('m_'),
      role: 'user',
      text,
      senderName: settings.user.name || '我',
      createdAt: Date.now(),
    };
    appendMessage('group', group.id, userMessage);

    const history = [...messages, userMessage];
    const speakers = members.length
      ? [...members].sort(() => Math.random() - 0.5).slice(0, Math.random() > 0.55 ? 2 : 1)
      : [];
    if (!speakers.length) return;

    setBusy(true);
    try {
      for (const speaker of speakers) {
        setSpeakingName(speaker.name);
        setStream('');
        const system = [
          `你正在扮演「${speaker.name}」，参与一个名为「${group.name}」的群聊。`,
          `群成员：${members.map((m) => m.name).join('、')}；用户叫「${settings.user.name || '我'}」。`,
          speaker.description ? `你的设定：${speaker.description}` : '',
          speaker.style ? `说话风格：${speaker.style}` : '',
          '像真人在群里聊天：1~2 句，口语化，可以接别人的话；不要旁白，不要加名字前缀。只输出你要发的消息。',
        ]
          .filter(Boolean)
          .join('\n');
        const historyPayload = history.slice(-24).map((m) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: m.role === 'assistant' ? `${m.senderName || '群友'}：${m.text}` : m.text,
        }));
        const full = await chatComplete(
          settings,
          [{ role: 'system', content: system }, ...historyPayload],
          (_delta, all) => setStream(all),
        );
        const reply = full.trim();
        if (reply) {
          const replyMessage: ChatMessage = {
            id: uid('m_'),
            role: 'assistant',
            text: reply,
            senderId: speaker.id,
            senderName: speaker.name,
            senderAvatar: speaker.avatar,
            createdAt: Date.now(),
          };
          history.push(replyMessage);
          appendMessage('group', group.id, replyMessage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '群聊请求失败');
    } finally {
      setBusy(false);
      setStream('');
      setSpeakingName('');
    }
  };

  const clear = () => {
    if (!window.confirm('清空这个群的聊天记录？')) return;
    clearConversation('group', group.id);
  };

  return (
    <section className="app-screen group-room">
      <header className="app-header">
        <button type="button" className="app-back" onClick={onBack} aria-label="返回">
          <Mdi path={ICONS.close} size={20} />
        </button>
        <div className="app-title-wrap">
          <h1>{group.name}</h1>
          <p>{members.map((m) => m.name).join('、')}</p>
        </div>
        <div className="app-header-right">
          <button type="button" className="icon-btn-plain" onClick={clear} aria-label="清空聊天">
            <Mdi path={ICONS.trash} size={18} />
          </button>
        </div>
      </header>

      <div className="group-messages">
        {messages.map((message) => {
          if (message.role === 'system') {
            return (
              <div key={message.id} className="msg-system">
                {message.text}
              </div>
            );
          }
          const mine = message.role === 'user';
          return (
            <div key={message.id} className={`group-msg${mine ? ' mine' : ''}`}>
              {!mine ? (
                <Avatar name={message.senderName} avatar={message.senderAvatar} size={34} />
              ) : null}
              <div className="group-msg-main">
                {!mine ? <div className="group-sender">{message.senderName}</div> : null}
                <div className="group-bubble">{message.text}</div>
              </div>
              {mine ? <Avatar name={settings.user.name || '我'} avatar={settings.user.avatar} size={34} /> : null}
            </div>
          );
        })}
        {busy ? (
          <div className="group-msg">
            <Avatar name={speakingName || '群友'} size={34} />
            <div className="group-msg-main">
              <div className="group-sender">{speakingName} 正在输入…</div>
              <div className="group-bubble typing">
                {stream ? stream : <><i /><i /><i /></>}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="chat-error">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      <div className="chat-composer">
        <div className="composer-input">
          <textarea
            value={input}
            rows={1}
            placeholder={`在「${group.name}」里说点什么`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="button" className="send-btn" disabled={busy || !input.trim()} onClick={() => void send()} aria-label="发送">
            {busy ? <Spinner size={16} /> : <Mdi path={ICONS.send} size={18} />}
          </button>
        </div>
      </div>
    </section>
  );
}
