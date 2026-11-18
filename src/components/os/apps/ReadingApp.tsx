'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { localUid, readLocal, writeLocal } from '@/lib/local-data';
import { EmptyState, ICONS, Mdi, Screen } from '../ui';

type Book = { id: string; name: string; text: string; progress: number; createdAt: number };

const KEY = 'sp.reading.v1';

export function ReadingApp({ onClose }: { onClose: () => void }) {
  const [books, setBooks] = useState<Book[]>(() => readLocal<Book[]>(KEY, []));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const initialProgress = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const current = books.find((book) => book.id === currentId) ?? null;

  useEffect(() => {
    if (!currentId) return;
    const el = readerRef.current;
    if (!el) return;
    el.scrollTop = (el.scrollHeight - el.clientHeight) * initialProgress.current;
  }, [currentId]);

  const persist = (next: Book[]) => {
    setBooks(next);
    writeLocal(KEY, next);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    if (!text.trim()) return;
    const book: Book = {
      id: localUid('bk_'),
      name: file.name.replace(/\.[^.]+$/, ''),
      text,
      progress: 0,
      createdAt: Date.now(),
    };
    persist([book, ...books]);
    setCurrentId(book.id);
  };

  const remove = (book: Book) => {
    if (!window.confirm(`删除《${book.name}》？`)) return;
    if (currentId === book.id) setCurrentId(null);
    persist(books.filter((item) => item.id !== book.id));
  };

  const openBook = (book: Book) => {
    initialProgress.current = book.progress;
    setCurrentId(book.id);
  };

  const onScroll = () => {
    if (!current || !readerRef.current) return;
    const el = readerRef.current;
    const max = el.scrollHeight - el.clientHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 1;
    persist(books.map((book) => (book.id === current.id ? { ...book, progress } : book)));
  };

  if (current) {
    return (
      <Screen
        title={current.name}
        onBack={() => setCurrentId(null)}
        right={
          <div className="reader-font">
            <button type="button" onClick={() => setFontSize((size) => Math.max(13, size - 1))}>
              A-
            </button>
            <button type="button" onClick={() => setFontSize((size) => Math.min(24, size + 1))}>
              A+
            </button>
          </div>
        }
      >
        <div
          ref={readerRef}
          className="reader-body"
          style={{ fontSize }}
          onScroll={onScroll}
        >
          <pre>{current.text}</pre>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title="阅读"
      subtitle={`${books.length} 本 · 存在本机`}
      onBack={onClose}
      right={
        <button type="button" className="icon-btn-plain" onClick={() => fileRef.current?.click()} aria-label="导入 txt">
          <Mdi path={ICONS.plus} size={22} />
        </button>
      }
    >
      <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => void importFile(e)} />
      {books.length === 0 ? (
        <EmptyState
          title="还没有书"
          hint="点右上角 + 导入 txt 文件，进度会保存在本机"
          action={
            <button type="button" className="primary-btn" onClick={() => fileRef.current?.click()}>
              导入 txt
            </button>
          }
        />
      ) : (
        <div className="simple-list">
          {books.map((book) => (
            <div key={book.id} className="simple-row">
              <button type="button" className="simple-main" onClick={() => openBook(book)}>
                <span className="simple-icon">
                  <Mdi path={ICONS.download} size={18} />
                </span>
                <span className="simple-text">
                  <strong>{book.name}</strong>
                  <small>已读 {Math.round(book.progress * 100)}%</small>
                </span>
                <span className="simple-state">继续读</span>
              </button>
              <button type="button" className="icon-btn-plain" onClick={() => remove(book)} aria-label="删除">
                <Mdi path={ICONS.trash} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
