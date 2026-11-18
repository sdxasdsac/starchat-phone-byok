'use client';

import { useState } from 'react';
import { localUid, readLocal, writeLocal } from '@/lib/local-data';
import { EmptyState, ICONS, Mdi, Screen } from '../ui';

type Item = { id: string; name: string; date: string; createdAt: number };

const KEY = 'sp.anniversary.v1';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function nextOccurrence(date: string): { days: number; years: number } {
  const base = new Date(`${date}T00:00:00`);
  const today = startOfToday();
  let next = new Date(today.getFullYear(), base.getMonth(), base.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  const years = next.getFullYear() - base.getFullYear();
  return { days, years };
}

export function AnniversaryApp({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Item[]>(() => readLocal<Item[]>(KEY, []));
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const persist = (next: Item[]) => {
    setItems(next);
    writeLocal(KEY, next);
  };

  const add = () => {
    if (!name.trim() || !date) return;
    persist([{ id: localUid('an_'), name: name.trim(), date, createdAt: Date.now() }, ...items]);
    setName('');
    setDate('');
  };

  const remove = (item: Item) => {
    if (!window.confirm(`删除「${item.name}」？`)) return;
    persist(items.filter((row) => row.id !== item.id));
  };

  return (
    <Screen title="纪念日" subtitle={`${items.length} 个日子`} onBack={onClose}>
      <div className="anniversary-form">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="名字，例如：在一起" />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="primary-btn" onClick={add} disabled={!name.trim() || !date}>
          添加纪念日
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="还没有纪念日" hint="加上一个日子，小手机帮你数着" />
      ) : (
        <div className="anniversary-list">
          {items.map((item) => {
            const info = nextOccurrence(item.date);
            const isToday = info.days === 0;
            return (
              <div key={item.id} className={`anniversary-card${isToday ? ' today' : ''}`}>
                <div className="anniversary-days">
                  <strong>{info.days}</strong>
                  <small>{isToday ? '今天' : '天后'}</small>
                </div>
                <div className="anniversary-main">
                  <strong>{item.name}</strong>
                  <small>
                    {item.date} · 第 {Math.max(1, info.years)} 年
                  </small>
                </div>
                <button type="button" className="icon-btn-plain" onClick={() => remove(item)} aria-label="删除">
                  <Mdi path={ICONS.trash} size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
