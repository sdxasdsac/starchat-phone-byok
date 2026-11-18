'use client';

import { useMemo, useState } from 'react';
import type { XhsNote, XhsProfile } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { chatComplete } from '@/lib/api';
import { buildSystemPrompt, xhsPrompt } from '@/lib/prompt';
import { parseLooseJson } from '@/lib/json';
import { uid } from '@/lib/store';
import { Avatar, EmptyState, ErrorNote, ICONS, Mdi, Screen, Spinner } from '../ui';

type Generated = {
  profile?: Partial<XhsProfile>;
  notes?: { title?: string; content?: string; coverEmoji?: string; coverColor?: string; likes?: string }[];
};

export function XhsApp({ onClose }: { onClose: () => void }) {
  const { settings, activePersona, xhs, setXhs, xhsProfile, setXhsProfile } = usePhone();
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [openNote, setOpenNote] = useState<XhsNote | null>(null);

  const profile = xhsProfile && xhsProfile.personaId === activePersona?.id ? xhsProfile : null;
  const notes = useMemo(
    () => xhs.filter((n) => !activePersona || n.personaId === activePersona.id),
    [xhs, activePersona],
  );

  const generate = async () => {
    if (!activePersona || generating) return;
    setGenerating(true);
    setError('');
    try {
      const raw = await chatComplete(settings, [
        { role: 'system', content: buildSystemPrompt(activePersona, settings) },
        { role: 'user', content: xhsPrompt(activePersona) },
      ]);
      const parsed = parseLooseJson<Generated>(raw);
      const p = parsed.profile ?? {};
      const nextProfile: XhsProfile = {
        personaId: activePersona.id,
        nickname: activePersona.name,
        handle: String(p.handle ?? 'star_' + activePersona.id.slice(-4)),
        bio: String(p.bio ?? activePersona.tagline ?? '记录日常'),
        ip: String(p.ip ?? '上海'),
        gender: p.gender === '男' ? '男' : '女',
        age: String(p.age ?? '22岁'),
        job: String(p.job ?? '生活博主'),
        following: String(p.following ?? '1'),
        fans: String(p.fans ?? '5.2万'),
        likes: String(p.likes ?? '131.4万'),
      };
      setXhsProfile(nextProfile);

      const now = Date.now();
      const nextNotes: XhsNote[] = (parsed.notes ?? []).slice(0, 9).map((n, index) => ({
        id: uid('xhs_'),
        personaId: activePersona.id,
        title: String(n.title ?? '无标题'),
        content: String(n.content ?? ''),
        coverEmoji: String(n.coverEmoji ?? '🌷').slice(0, 4),
        coverColor: String(n.coverColor ?? '#FFD9E6'),
        likes: String(n.likes ?? `${Math.floor(Math.random() * 9000) + 100}`),
        createdAt: now - index * 86_400_000,
      }));
      setXhs([...nextNotes, ...xhs.filter((n) => n.personaId !== activePersona.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成小红书主页失败');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen
      title="小红薯"
      onBack={onClose}
      className="xhs-screen"
      right={
        <button type="button" className="icon-btn-plain" onClick={() => void generate()} disabled={generating}>
          {generating ? <Spinner size={18} /> : <Mdi path={ICONS.refresh} size={20} />}
        </button>
      }
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {!profile ? (
        <EmptyState
          title={activePersona ? `给${activePersona.name}开一个小红书主页` : '还没有角色'}
          hint="会生成主页资料和 3 篇笔记，内容由你配置的文字模型生成"
          action={
            <button type="button" className="primary-btn" onClick={() => void generate()} disabled={generating || !activePersona}>
              {generating ? <Spinner size={16} /> : <Mdi path={ICONS.refresh} size={16} />}
              {generating ? '生成中…' : '一键生成主页'}
            </button>
          }
        />
      ) : (
        <>
          <div className="xhs-profile">
            <div className="xhs-cover" />
            <div className="xhs-profile-main">
              <Avatar persona={activePersona ?? undefined} name={profile.nickname} size={64} />
              <div className="xhs-profile-info">
                <div className="xhs-name">{profile.nickname}</div>
                <div className="xhs-handle">小红薯号：{profile.handle}</div>
                <div className="xhs-bio">{profile.bio}</div>
                <div className="xhs-tags">
                  <span>{profile.gender === '男' ? '♂' : '♀'} {profile.age}</span>
                  <span>{profile.job}</span>
                  <span>IP 属地：{profile.ip}</span>
                </div>
              </div>
            </div>
            <div className="xhs-stats">
              <div><strong>{profile.following}</strong><span>关注</span></div>
              <div><strong>{profile.fans}</strong><span>粉丝</span></div>
              <div><strong>{profile.likes}</strong><span>获赞与收藏</span></div>
            </div>
            <div className="xhs-actions">
              <button type="button" className="pill-btn">互相关注</button>
              <button type="button" className="pill-btn">私信</button>
            </div>
          </div>

          <div className="xhs-tabs">
            <span className="on">笔记 {notes.length}</span>
            <span>收藏</span>
            <span>赞过</span>
          </div>

          {notes.length === 0 ? (
            <EmptyState title="还没有笔记" hint="点右上角刷新按钮生成" />
          ) : (
            <div className="xhs-grid">
              {notes.map((note) => (
                <button key={note.id} type="button" className="xhs-note" onClick={() => setOpenNote(note)}>
                  <span className="xhs-note-cover" style={{ background: note.coverColor }}>
                    <span>{note.coverEmoji}</span>
                  </span>
                  <span className="xhs-note-title">{note.title}</span>
                  <span className="xhs-note-likes">♡ {note.likes}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openNote ? (
        <div className="sheet-mask" onClick={() => setOpenNote(null)}>
          <div className="sheet xhs-detail" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">
              <span>{openNote.title}</span>
              <button type="button" className="icon-btn-plain" onClick={() => setOpenNote(null)}>
                <Mdi path={ICONS.close} size={18} />
              </button>
            </div>
            <div className="xhs-detail-cover" style={{ background: openNote.coverColor }}>
              {openNote.coverEmoji}
            </div>
            <p className="xhs-detail-content">{openNote.content}</p>
            <div className="xhs-detail-foot">
              <Avatar persona={activePersona ?? undefined} name={profile?.nickname} size={28} />
              <span>{profile?.nickname}</span>
              <button
                type="button"
                className={`xhs-like${openNote.liked ? ' on' : ''}`}
                onClick={() => {
                  const next = xhs.map((n) =>
                    n.id === openNote.id
                      ? { ...n, liked: !n.liked, likes: n.liked ? n.likes : `${n.likes}+` }
                      : n,
                  );
                  setXhs(next);
                  setOpenNote({ ...openNote, liked: !openNote.liked });
                }}
              >
                <Mdi path={openNote.liked ? ICONS.heart : ICONS.heartOutline} size={16} />
                {openNote.likes}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
