'use client';

import { useState } from 'react';
import { localUid, readLocal, writeLocal } from '@/lib/local-data';
import { EmptyState, ICONS, Mdi, Screen } from '../ui';

type Kind = 'movie' | 'book';

type Entry = {
  id: string;
  kind: Kind;
  title: string;
  rating: number;
  comment: string;
  createdAt: number;
};

const KEY = 'sp.douban.v1';

export function DoubanApp({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>(() => readLocal<Entry[]>(KEY, []));
  const [kind, setKind] = useState<Kind>('movie');
  const [title, setTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const persist = (next: Entry[]) => {
    setEntries(next);
    writeLocal(KEY, next);
  };

  const list = entries.filter((item) => item.kind === kind);

  const save = () => {
    const name = title.trim();
    if (!name) return;
    persist([
      {
        id: localUid('db_'),
        kind,
        title: name,
        rating,
        comment: comment.trim(),
        createdAt: Date.now(),
      },
      ...entries,
    ]);
    setTitle('');
    setRating(0);
    setComment('');
  };

  const remove = (entry: Entry) => {
    if (!window.confirm(`删除《${entry.title}》？`)) return;
    persist(entries.filter((item) => item.id !== entry.id));
  };

  return (
    <Screen title="豆瓣" subtitle={`${entries.length} 条记录 · 只存在本机`} onBack={onClose}>
      <div className="db-tabs">
        {(
          [
            ['movie', '电影'],
            ['book', '读书'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`db-tab${kind === key ? ' active' : ''}`}
            onClick={() => setKind(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="db-compose">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'movie' ? '看的什么电影？' : '在读什么书？'}
        />
        <div className="db-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`db-star${star <= rating ? ' on' : ''}`}
              onClick={() => setRating(star === rating ? 0 : star)}
              aria-label={`${star} 星`}
            >
              ★
            </button>
          ))}
          <span className="db-rating-text">{rating ? `${rating} 星` : '还没打分'}</span>
        </div>
        <textarea
          className="textarea"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="写一句短评…"
        />
        <button type="button" className="primary-btn db-save" onClick={save} disabled={!title.trim()}>
          添加记录
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={kind === 'movie' ? '还没有电影记录' : '还没有读书记录'}
          hint="上面填个名字就能记下来，数据只存在这台设备"
        />
      ) : (
        <div className="db-list">
          {list.map((entry) => (
            <article key={entry.id} className="db-card">
              <div className="db-card-head">
                <span className="db-cover">{kind === 'movie' ? '🎬' : '📖'}</span>
                <div className="db-card-title">
                  <strong>{entry.title}</strong>
                  <span className="db-card-stars">
                    {entry.rating ? '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating) : '未评分'}
                  </span>
                </div>
                <button type="button" className="icon-btn-plain" onClick={() => remove(entry)} aria-label="删除">
                  <Mdi path={ICONS.trash} size={15} />
                </button>
              </div>
              {entry.comment ? <p className="db-comment">{entry.comment}</p> : null}
            </article>
          ))}
        </div>
      )}
    </Screen>
  );
}
