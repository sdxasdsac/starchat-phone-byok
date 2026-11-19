'use client';

import { useMemo, useRef, useState } from 'react';
import type { MomentPost } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { chatComplete, generateImage } from '@/lib/api';
import { buildSystemPrompt, momentsPrompt } from '@/lib/prompt';
import { parseLooseJson } from '@/lib/json';
import { uid } from '@/lib/store';
import { saveMedia } from '@/lib/media-db';
import { fileToDataUrl } from '@/lib/image-utils';
import { MediaImage } from '../ChatRoom';
import { Avatar, EmptyState, ErrorNote, ICONS, Mdi, Screen, Spinner } from '../ui';

type GeneratedPost = {
  text: string;
  images?: { emoji?: string; color?: string }[];
  time?: string;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function MomentsApp({ onClose }: { onClose: () => void }) {
  const { settings, activePersona, moments, setMoments } = usePhone();
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busyComment, setBusyComment] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | undefined>(undefined);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoPrompt, setPhotoPrompt] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const feed = useMemo(() => [...moments].sort((a, b) => b.createdAt - a.createdAt), [moments]);

  const generate = async () => {
    if (!activePersona || generating) return;
    setGenerating(true);
    setError('');
    try {
      const raw = await chatComplete(settings, [
        { role: 'system', content: buildSystemPrompt(activePersona, settings) },
        { role: 'user', content: momentsPrompt(activePersona, settings) },
      ]);
      const parsed = parseLooseJson<GeneratedPost[]>(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('模型没有生成动态');
      const now = Date.now();
      const posts: MomentPost[] = parsed.slice(0, 5).map((item, index) => ({
        id: uid('mo_'),
        personaId: activePersona.id,
        authorName: activePersona.name,
        authorAvatar: activePersona.avatar,
        text: String(item.text ?? '').trim() || '……',
        images: (item.images ?? []).slice(0, 2).map((img) => ({
          emoji: String(img.emoji ?? '🌄').slice(0, 4),
          color: String(img.color ?? '#FFE3EC'),
        })),
        createdAt: now - index * 3_600_000,
        likes: [],
        comments: [],
      }));
      setMoments([...posts, ...moments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成动态失败');
    } finally {
      setGenerating(false);
    }
  };

  const publish = () => {
    const text = draft.trim();
    if (!text) return;
    const post: MomentPost = {
      id: uid('mo_'),
      personaId: activePersona?.id ?? 'user',
      authorName: settings.user.name || '我',
      authorAvatar: settings.user.avatar,
      text,
      images: [],
      photoId,
      photoUrl,
      createdAt: Date.now(),
      likes: [],
      comments: [],
    };
    setMoments([post, ...moments]);
    setDraft('');
    setPhotoId(undefined);
    setPhotoUrl(undefined);
    setComposing(false);
    void autoInteract(post);
  };

  /** 角色主动点赞 + 评论你的动态 */
  const autoInteract = async (post: MomentPost) => {
    if (!activePersona || !settings.text.apiKey.trim()) return;
    try {
      const raw = await chatComplete(settings, [
        { role: 'system', content: buildSystemPrompt(activePersona, settings) },
        {
          role: 'user',
          content: `你刷到了「${post.authorName}」刚发的朋友圈：「${post.text}」。用${activePersona.name}的口吻留一条评论，20 字以内，只输出评论内容，不要引号。`,
        },
      ]);
      const text = raw.trim().replace(/^["「]|["」]$/g, '');
      if (!text) return;
      setMoments((prev: MomentPost[]) =>
        prev.map((p: MomentPost) =>
          p.id === post.id
            ? {
                ...p,
                likes: p.likes.includes(activePersona.name) ? p.likes : [...p.likes, activePersona.name],
                comments: [
                  ...p.comments,
                  { id: uid('cm_'), author: activePersona.name, text, createdAt: Date.now() },
                ],
              }
            : p,
        ),
      );
    } catch {
      // 互动失败就算了，不打扰
    }
  };

  const makePhoto = async () => {
    const prompt = photoPrompt.trim();
    if (!prompt || photoBusy) return;
    setPhotoBusy(true);
    setError('');
    try {
      const result = await generateImage(settings, prompt);
      if (result.dataUrl) {
        const id = await saveMedia(result.dataUrl);
        setPhotoId(id);
        setPhotoUrl(undefined);
      } else {
        setPhotoId(undefined);
        setPhotoUrl(result.url);
      }
      setPhotoPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生图失败');
    } finally {
      setPhotoBusy(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const id = await saveMedia(dataUrl);
      setPhotoId(id);
      setPhotoUrl(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片读取失败');
    }
  };

  const toggleLike = (post: MomentPost) => {
    const me = settings.user.name || '我';
    const liked = post.likes.includes(me);
    const next = moments.map((p) =>
      p.id === post.id ? { ...p, likes: liked ? p.likes.filter((n) => n !== me) : [...p.likes, me] } : p,
    );
    setMoments(next);
  };

  const addComment = (post: MomentPost) => {
    const text = (commentDrafts[post.id] ?? '').trim();
    if (!text) return;
    const next = moments.map((p) =>
      p.id === post.id
        ? {
            ...p,
            comments: [
              ...p.comments,
              { id: uid('cm_'), author: settings.user.name || '我', text, createdAt: Date.now() },
            ],
          }
        : p,
    );
    setMoments(next);
    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
  };

  const askCharacterComment = async (post: MomentPost) => {
    if (!activePersona || busyComment) return;
    setBusyComment(post.id);
    setError('');
    try {
      const raw = await chatComplete(settings, [
        { role: 'system', content: buildSystemPrompt(activePersona, settings) },
        {
          role: 'user',
          content: `你刷到了这条朋友圈：「${post.text}」。用${activePersona.name}的口吻留一条评论，只输出评论内容，20 字以内，不要引号。`,
        },
      ]);
      const text = raw.trim().replace(/^["「]|["」]$/g, '');
      if (!text) throw new Error('没有生成评论');
      const next = moments.map((p) =>
        p.id === post.id
          ? {
              ...p,
              comments: [
                ...p.comments,
                { id: uid('cm_'), author: activePersona.name, text, createdAt: Date.now() },
              ],
            }
          : p,
      );
      setMoments(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成评论失败');
    } finally {
      setBusyComment(null);
    }
  };

  return (
    <Screen
      title="朋友圈"
      subtitle={activePersona ? `${activePersona.name} 的生活` : undefined}
      onBack={onClose}
      right={
        <button type="button" className="icon-btn-plain" onClick={() => setComposing(true)} aria-label="发动态">
          <Mdi path={ICONS.plus} size={22} />
        </button>
      }
      className="moments-screen"
    >
      <div className="moments-cover">
        <div className="moments-cover-deco" />
        <div className="moments-me">
          <Avatar name={settings.user.name || '我'} avatar={settings.user.avatar} size={54} />
          <div>
            <div className="moments-me-name">{settings.user.name || '我'}</div>
            <div className="moments-me-bio">{settings.user.bio || '记录生活'}</div>
          </div>
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="moments-toolbar">
        <button type="button" className="soft-btn" onClick={() => void generate()} disabled={generating || !activePersona}>
          {generating ? <Spinner size={16} /> : <Mdi path={ICONS.refresh} size={16} />}
          {generating ? '生成中…' : `让${activePersona?.name ?? 'TA'}发动态`}
        </button>
        <button type="button" className="soft-btn" onClick={() => setComposing(true)}>
          <Mdi path={ICONS.edit} size={16} /> 发一条
        </button>
      </div>

      {composing ? (
        <div className="compose-card">
          <textarea
            className="textarea"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="这一刻的想法…"
          />
          <div className="compose-photo">
            <div className="compose-photo-row">
              <input
                className="input"
                value={photoPrompt}
                onChange={(e) => setPhotoPrompt(e.target.value)}
                placeholder="配图：描述画面让 AI 生成"
              />
              <button type="button" className="soft-btn" onClick={() => void makePhoto()} disabled={photoBusy || !photoPrompt.trim()}>
                {photoBusy ? <Spinner size={14} /> : null}
                生成
              </button>
              <button type="button" className="soft-btn" onClick={() => fileRef.current?.click()}>
                上传
              </button>
            </div>
            {photoId || photoUrl ? (
              <div className="compose-photo-preview">
                <MediaImage imageId={photoId} imageUrl={photoUrl} alt="配图" />
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setPhotoId(undefined);
                    setPhotoUrl(undefined);
                  }}
                >
                  移除配图
                </button>
              </div>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          <div className="compose-actions">
            <button type="button" className="text-btn" onClick={() => setComposing(false)}>
              取消
            </button>
            <button type="button" className="primary-btn" onClick={publish} disabled={!draft.trim()}>
              发布
            </button>
          </div>
        </div>
      ) : null}

      {feed.length === 0 ? (
        <EmptyState title="还没有动态" hint="点上面的按钮，让角色发一条朋友圈" />
      ) : (
        <div className="moment-list">
          {feed.map((post) => {
            const liked = post.likes.includes(settings.user.name || '我');
            return (
              <article key={post.id} className="moment-card">
                <Avatar name={post.authorName} avatar={post.authorAvatar} size={40} />
                <div className="moment-main">
                  <div className="moment-author">{post.authorName}</div>
                  <p className="moment-text">{post.text}</p>
                  {post.photoId || post.photoUrl ? (
                    <div className="moment-photo">
                      <MediaImage imageId={post.photoId} imageUrl={post.photoUrl} alt="配图" />
                    </div>
                  ) : post.images.length > 0 ? (
                    <div className="moment-images">
                      {post.images.map((img, index) => (
                        <span
                          key={index}
                          className="moment-image"
                          style={{ background: img.color }}
                          title={img.emoji}
                        >
                          {img.emoji}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="moment-meta">
                    <span>{timeAgo(post.createdAt)}</span>
                    <div className="moment-actions">
                      <button type="button" className={liked ? 'on' : ''} onClick={() => toggleLike(post)}>
                        <Mdi path={liked ? ICONS.heart : ICONS.heartOutline} size={16} />
                        点赞
                      </button>
                      <button type="button" onClick={() => void askCharacterComment(post)} disabled={busyComment === post.id}>
                        {busyComment === post.id ? <Spinner size={14} /> : <Mdi path={ICONS.comment} size={16} />}
                        让TA评论
                      </button>
                    </div>
                  </div>

                  {post.likes.length > 0 ? (
                    <div className="moment-likes">
                      <Mdi path={ICONS.heart} size={14} />
                      {post.likes.join('、')}
                    </div>
                  ) : null}

                  {post.comments.length > 0 ? (
                    <div className="moment-comments">
                      {post.comments.map((comment) => (
                        <p key={comment.id}>
                          <strong>{comment.author}</strong>
                          <span>{comment.text}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div className="moment-comment-input">
                    <input
                      value={commentDrafts[post.id] ?? ''}
                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addComment(post);
                      }}
                      placeholder="评论…"
                    />
                    <button type="button" className="icon-btn-plain" onClick={() => addComment(post)}>
                      <Mdi path={ICONS.send} size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
