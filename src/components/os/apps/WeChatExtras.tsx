'use client';

import { useMemo, useState } from 'react';
import {
  mdiArrowLeft,
  mdiChevronRight,
  mdiMessageTextOutline,
  mdiPhoneOutline,
  mdiVideoOutline,
  mdiDotsHorizontal,
  mdiLockOutline,
  mdiStarOutline,
  mdiAccountMultipleOutline,
  mdiCellphoneArrowDown,
  mdiAlertCircleOutline,
  mdiPencilOutline,
} from '@mdi/js';
import type { MomentPost, Persona } from '@/lib/types';
import { MediaImage } from '../ChatRoom';
import { Avatar, ICONS, Mdi } from '../ui';

/** 通讯录里的朋友资料页（对齐真实微信：资料 → 发消息 / 音视频通话） */
export function ContactProfile({
  persona,
  starred,
  onBack,
  onMessage,
  onOpenSettings,
}: {
  persona: Persona;
  starred: boolean;
  onBack: () => void;
  onMessage: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="app-screen wx-profile">
      <header className="wx-profile-head">
        <button type="button" className="wx-icon-btn" onClick={onBack} aria-label="返回">
          <Mdi path={mdiArrowLeft} size={22} />
        </button>
        <span className="wx-profile-head-spacer" />
        <button type="button" className="wx-icon-btn" onClick={onOpenSettings} aria-label="朋友设置">
          <Mdi path={mdiDotsHorizontal} size={22} />
        </button>
      </header>

      <div className="wx-profile-body">
        <div className="wx-profile-card">
          <Avatar persona={persona} size={64} />
          <div className="wx-profile-info">
            <div className="wx-profile-name">
              {persona.name}
              {starred ? <span className="wx-star">★</span> : null}
            </div>
            <div className="wx-profile-meta">昵称：{persona.tagline || persona.name}</div>
            <div className="wx-profile-meta">微信号：zhuya_{persona.id.slice(-6)}</div>
            <div className="wx-profile-meta">地区：{persona.scenario?.slice(0, 12) || '未设置'}</div>
          </div>
        </div>

        <button type="button" className="wx-profile-row" onClick={onOpenSettings}>
          <span className="wx-profile-row-main">
            <span className="wx-profile-row-title">朋友资料</span>
            <span className="wx-profile-row-hint">添加备注名、电话、标签、备忘、照片等，并设置朋友权限。</span>
          </span>
          <Mdi path={mdiChevronRight} size={18} />
        </button>

        <div className="wx-profile-actions">
          <button type="button" className="wx-profile-action" onClick={onMessage}>
            <Mdi path={mdiMessageTextOutline} size={22} />
            <span>发消息</span>
          </button>
          <button type="button" className="wx-profile-action" onClick={onMessage}>
            <Mdi path={mdiPhoneOutline} size={22} />
            <span>音视频通话</span>
          </button>
        </div>
      </div>
    </section>
  );
}

/** 朋友设置页（星标 / 黑名单 / 删除） */
export function ContactSettings({
  persona,
  starred,
  blocked,
  onBack,
  onToggleStar,
  onToggleBlock,
  onDelete,
}: {
  persona: Persona;
  starred: boolean;
  blocked: boolean;
  onBack: () => void;
  onToggleStar: () => void;
  onToggleBlock: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="app-screen wx-setting">
      <header className="wx-setting-head">
        <button type="button" className="app-back" onClick={onBack} aria-label="返回">
          <Mdi path={mdiArrowLeft} size={22} />
        </button>
        <h1>朋友设置</h1>
        <span className="wx-setting-spacer" />
      </header>
      <div className="wx-setting-body">
        <div className="wx-cell-group">
          <div className="wx-cell">
            <span className="wx-cell-text">设置朋友资料</span>
            <span className="wx-cell-value">{persona.name}</span>
            <Mdi path={mdiChevronRight} size={18} />
          </div>
          <div className="wx-cell">
            <span className="wx-cell-text">朋友权限</span>
            <span className="wx-cell-value">聊天、朋友圈</span>
            <Mdi path={mdiChevronRight} size={18} />
          </div>
        </div>

        <div className="wx-cell-group">
          <div className="wx-cell">
            <span className="wx-cell-icon">
              <Mdi path={mdiAccountMultipleOutline} size={19} />
            </span>
            <span className="wx-cell-text">把她推荐给朋友</span>
            <Mdi path={mdiChevronRight} size={18} />
          </div>
          <div className="wx-cell">
            <span className="wx-cell-icon">
              <Mdi path={mdiCellphoneArrowDown} size={19} />
            </span>
            <span className="wx-cell-text">添加到桌面</span>
            <Mdi path={mdiChevronRight} size={18} />
          </div>
        </div>

        <div className="wx-cell-group">
          <button type="button" className="wx-cell" onClick={onToggleStar}>
            <span className="wx-cell-icon">
              <Mdi path={mdiStarOutline} size={19} />
            </span>
            <span className="wx-cell-text">设为星标朋友</span>
            <span className={`wx-switch${starred ? ' on' : ''}`} aria-hidden>
              <i />
            </span>
          </button>
          <button type="button" className="wx-cell" onClick={onToggleBlock}>
            <span className="wx-cell-icon">
              <Mdi path={mdiLockOutline} size={19} />
            </span>
            <span className="wx-cell-text">加入黑名单</span>
            <span className={`wx-switch${blocked ? ' on' : ''}`} aria-hidden>
              <i />
            </span>
          </button>
          <div className="wx-cell">
            <span className="wx-cell-icon">
              <Mdi path={mdiAlertCircleOutline} size={19} />
            </span>
            <span className="wx-cell-text">投诉</span>
            <Mdi path={mdiChevronRight} size={18} />
          </div>
        </div>

        <button type="button" className="wx-delete" onClick={onDelete}>
          删除
        </button>
      </div>
    </section>
  );
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}年|${d.getMonth() + 1}月`;
}

/** 朋友圈相册：按年月分组的三列九宫格（对齐真实微信「相册」页） */
export function MomentsAlbum({
  posts,
  personaName,
  onBack,
  onOpenFeed,
}: {
  posts: MomentPost[];
  personaName: string;
  onBack: () => void;
  onOpenFeed: () => void;
}) {
  const [tab, setTab] = useState<'album' | 'status'>('album');
  const groups = useMemo(() => {
    const map = new Map<string, MomentPost[]>();
    for (const post of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
      const key = monthKey(post.createdAt);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [posts]);

  const total = posts.length;

  return (
    <section className="app-screen wx-album">
      <header className="wx-album-head">
        <button type="button" className="app-back" onClick={onBack} aria-label="返回">
          <Mdi path={mdiArrowLeft} size={22} />
        </button>
        <h1>相册</h1>
        <span className="wx-album-spacer" />
      </header>

      <div className="wx-album-tabs">
        <button type="button" className={tab === 'album' ? 'on' : ''} onClick={() => setTab('album')}>
          朋友圈相册
        </button>
        <button type="button" className={tab === 'status' ? 'on' : ''} onClick={() => setTab('status')}>
          状态
        </button>
      </div>

      <div className="wx-album-body">
        <button type="button" className="wx-album-feed-link" onClick={onOpenFeed}>
          我的朋友圈
          <Mdi path={mdiChevronRight} size={16} />
        </button>

        {tab === 'status' ? (
          <div className="wx-album-empty">
            <Mdi path={mdiPencilOutline} size={28} />
            <p>还没有状态</p>
          </div>
        ) : total === 0 ? (
          <div className="wx-album-empty">
            <Mdi path={ICONS.image} size={28} />
            <p>{personaName} 还没有发过朋友圈</p>
            <button type="button" className="primary-btn small" onClick={onOpenFeed}>
              去朋友圈看看
            </button>
          </div>
        ) : (
          groups.map(([key, list]) => {
            const [year, month] = key.split('|');
            return (
              <div key={key} className="wx-album-group">
                <div className="wx-album-year">{year}</div>
                <div className="wx-album-month">{month}</div>
                <div className="wx-album-grid">
                  {list.map((post) =>
                    post.photoId || post.photoUrl ? (
                      <button
                        key={post.id}
                        type="button"
                        className="wx-album-cell photo"
                        onClick={onOpenFeed}
                        title={post.text.slice(0, 40)}
                      >
                        <MediaImage imageId={post.photoId} imageUrl={post.photoUrl} alt="朋友圈照片" />
                      </button>
                    ) : (
                      <button
                        key={post.id}
                        type="button"
                        className="wx-album-cell emoji"
                        onClick={onOpenFeed}
                        title={post.text.slice(0, 40)}
                      >
                        <span>{post.images[0]?.emoji || '🌸'}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
