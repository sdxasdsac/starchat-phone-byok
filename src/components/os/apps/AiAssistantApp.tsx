'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePhone } from '../PhoneContext';
import { chatComplete } from '@/lib/api';
import { readLocal, writeLocal } from '@/lib/local-data';
import { uid } from '@/lib/store';
import { ICONS, Mdi } from '../ui';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; createdAt: number };

const KEY = 'sp.aiassistant.v1';

const QUICK = [
  { label: '怎么填 API Key', text: '我第一次用，要怎么填 API Key？' },
  { label: '让角色主动找我', text: '怎么让角色主动发消息？' },
  { label: '帮我写世界书', text: '帮我写一段世界书，适合放在角色设定里。' },
  { label: '朋友圈配图', text: '朋友圈怎么配图？' },
];

function systemPrompt(userName: string): string {
  return [
    '你是「小手机」内置的 AI 助手，负责教用户使用这部手机。',
    `用户叫「${userName || '我'}」。`,
    '手机里的 App：聊天、微信（四栏：微信/通讯录/发现/我）、LINE、朋友圈、小红薯、豆瓣、角色库、设置、主题、日历、应用市场、音乐、手记、阅读、纪念日、相册。',
    '关键用法：',
    '- 首次使用：设置 → 文字模型，填 Base URL / API Key / 模型名，点「测试连接」。',
    '- 生图：设置 → 图像 API；朋友圈发动态时可以直接「生成」或「上传」配图。',
    '- 语音：设置 → 语音合成（朗读）与语音识别（语音输入）。',
    '- 角色主动发消息：设置 → 剧情预设 → 角色主动发消息（默认开启）。',
    '- 世界书：角色库 → 编辑角色 → 预设世界书可选内置 42 本，也能「存为我的世界书」。',
    '- 我的预设：设置 → 剧情预设 → 我的预设，写风格指令，支持 {{char}} / {{user}}。',
    '- 拍一拍：在微信聊天里双击对方头像。',
    '- 朋友圈：你发动态后，当前角色会自动点赞 + 评论。',
    '回答要短、直接、可操作，最多 3 句，必要时给步骤。不要编造不存在的功能。',
  ].join('\n');
}

export function AiAssistantApp({ onClose }: { onClose: () => void }) {
  const { settings } = usePhone();
  const [messages, setMessages] = useState<Msg[]>(() => readLocal<Msg[]>(KEY, []));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      if (!settings.text.apiKey.trim()) {
        setMessages((prev) => {
          const next: Msg[] = [
            ...prev,
            { id: uid('ai_'), role: 'user', text, createdAt: Date.now() },
            {
              id: uid('ai_'),
              role: 'assistant',
              text: '还没有填文字 API Key。先打开「设置 → 文字模型」，填 Base URL、API Key 和模型名，保存后再来问我。',
              createdAt: Date.now(),
            },
          ];
          writeLocal(KEY, next.slice(-60));
          return next;
        });
        setInput('');
        return;
      }
      const current = messages;
      const next: Msg[] = [...current, { id: uid('ai_'), role: 'user', text, createdAt: Date.now() }];
      setMessages(next);
      writeLocal(KEY, next.slice(-60));
      setInput('');
      setSending(true);
      try {
        const reply = await chatComplete(settings, [
          { role: 'system', content: systemPrompt(settings.user.name) },
          ...current.slice(-12).map((m) => ({ role: m.role, content: m.text })),
          { role: 'user', content: text },
        ]);
        const answer = reply.trim() || '……';
        setMessages((prev) => {
          const merged: Msg[] = [...prev, { id: uid('ai_'), role: 'assistant', text: answer, createdAt: Date.now() }];
          writeLocal(KEY, merged.slice(-60));
          return merged;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '请求失败';
        setMessages((prev) => {
          const merged: Msg[] = [
            ...prev,
            { id: uid('ai_'), role: 'assistant', text: `（助手连接失败：${message}）`, createdAt: Date.now() },
          ];
          writeLocal(KEY, merged.slice(-60));
          return merged;
        });
      } finally {
        setSending(false);
      }
    },
    [input, messages, sending, settings],
  );

  return (
    <section className="chat-room chat ai-room">
      <header className="chat-head">
        <button type="button" className="app-back" onClick={onClose} aria-label="返回">
          <Mdi path={ICONS.close} size={20} />
        </button>
        <div className="chat-head-main">
          <span className="ai-avatar">
            <Mdi path={ICONS.spark} size={18} />
          </span>
          <div>
            <div className="chat-head-name">AI 助手</div>
            <div className="chat-head-status">{sending ? '正在想…' : '问它小手机怎么用'}</div>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn-plain"
          onClick={() => {
            if (!window.confirm('清空助手对话？')) return;
            setMessages([]);
            writeLocal(KEY, []);
          }}
          aria-label="清空"
        >
          <Mdi path={ICONS.trash} size={18} />
        </button>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <p className="ai-welcome-title">我是小手机的 AI 助手</p>
            <p className="ai-welcome-hint">可以问我怎么填 API Key、怎么让角色主动找你、怎么写世界书。</p>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role === 'user' ? 'user' : 'assistant'}`}>
            <div className="msg-main">
              <div className="bubble">
                <p>{m.text}</p>
              </div>
            </div>
          </div>
        ))}
        {sending ? (
          <div className="msg-row assistant">
            <div className="msg-main">
              <div className="bubble typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="ai-quick">
        {QUICK.map((q) => (
          <button key={q.label} type="button" className="ai-chip" onClick={() => void send(q.text)} disabled={sending}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="chat-composer">
        <div className="composer-input">
          <textarea
            value={input}
            rows={1}
            placeholder="问 AI 助手…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className="send-btn"
            disabled={sending || !input.trim()}
            onClick={() => void send()}
            aria-label="发送"
          >
            <Mdi path={ICONS.send} size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
