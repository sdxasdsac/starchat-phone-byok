'use client';

import { useState } from 'react';
import { localUid, readLocal, writeLocal } from '@/lib/local-data';
import { EmptyState, ICONS, Mdi, Screen } from '../ui';

type Entry = { id: string; date: string; mood: string; text: string; createdAt: number };

const KEY = 'sp.diary.v1';
const MOODS = ['😊', '😌', '🥺', '😤', '😴', '🌧️', '☀️', '🌙'];

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function DiaryApp({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>(() => readLocal<Entry[]>(KEY, []));
  const [date, setDate] = useState(today());
  const [mood, setMood] = useState('😊');
  const [text, setText] = useState('');

  const persist = (next: Entry[]) => {
    setEntries(next);
    writeLocal(KEY, next);
  };

  const save = () => {
    const content = text.trim();
    if (!content) return;
    const entry: Entry = { id: localUid('di_'), date, mood, text: content, createdAt: Date.now() };
    persist([entry, ...entries]);
    setText('');
  };

  const remove = (entry: Entry) => {
    if (!window.confirm('删除这篇日记？')) return;
    persist(entries.filter((item) => item.id !== entry.id));
  };

  return (
    <Screen title="日记" subtitle={`${entries.length} 篇 · 只存在本机`} onBack={onClose}>
      <div className="diary-compose">
        <div className="diary-compose-top">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="mood-row">
            {MOODS.map((item) => (
              <button
                key={item}
                type="button"
                className={item === mood ? 'mood-chip active' : 'mood-chip'}
                onClick={() => setMood(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <textarea
          className="textarea"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今天发生了什么…"
        />
        <div className="diary-compose-actions">
          <button type="button" className="primary-btn" onClick={save} disabled={!text.trim()}>
            保存日记
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="还没有日记" hint="写下的内容只保存在这台设备上" />
      ) : (
        <div className="diary-list">
          {entries.map((entry) => (
            <article key={entry.id} className="diary-card">
              <div className="diary-card-head">
                <span className="diary-date">{entry.date}</span>
                <span className="diary-mood">{entry.mood}</span>
                <button type="button" className="icon-btn-plain" onClick={() => remove(entry)} aria-label="删除">
                  <Mdi path={ICONS.trash} size={15} />
                </button>
              </div>
              <p>{entry.text}</p>
            </article>
          ))}
        </div>
      )}
    </Screen>
  );
}
