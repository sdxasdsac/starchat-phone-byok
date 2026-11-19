'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { mdiPlus, mdiDeleteOutline, mdiDownload, mdiUpload, mdiChevronRight } from '@mdi/js';
import { usePhone } from '../PhoneContext';
import { EmptyState, ICONS, Mdi, Screen, Spinner } from '../ui';
import { readLocal, writeLocal } from '@/lib/local-data';
import { exportAll, importAll } from '@/lib/store';
import { STICKER_PACKS } from '@/lib/nannan-stickers';
import { BUILTIN_WORLDBOOKS } from '@/lib/builtin-worldbooks';
import { loadThemePacks, type ThemePack } from '@/lib/phone-theme-pack';

type Tab = 'overview' | 'books' | 'stickers' | 'preset' | 'backup';
type MineBook = { id: string; name: string; text: string };

const BOOKS_KEY = 'sp.worldbooks.mine.v1';

/** 素材仓库：世界书 / 表情包 / 预设 / 备份，全部存在本机 */
export function MaterialVaultApp({ onClose }: { onClose: () => void }) {
  const { personas, moments, settings, setSettings, conversations } = usePhone();
  const [tab, setTab] = useState<Tab>('overview');
  const [books, setBooks] = useState<MineBook[]>([]);
  const [packs, setPacks] = useState<ThemePack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [draftName, setDraftName] = useState('');
  const [draftText, setDraftText] = useState('');
  const [hint, setHint] = useState('');
  const bookFileRef = useRef<HTMLInputElement | null>(null);
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBooks(readLocal<MineBook[]>(BOOKS_KEY, []));
    loadThemePacks()
      .then((list) => setPacks(list))
      .finally(() => setLoadingPacks(false));
  }, []);

  const saveBooks = (next: MineBook[]) => {
    setBooks(next);
    writeLocal(BOOKS_KEY, next);
  };

  const toast = (text: string) => {
    setHint(text);
    window.setTimeout(() => setHint(''), 2200);
  };

  const stickerCount = useMemo(
    () => STICKER_PACKS.reduce((sum, pack) => sum + pack.items.length, 0),
    [],
  );

  const addBook = () => {
    const name = draftName.trim();
    const text = draftText.trim();
    if (!name || !text) {
      toast('书名和内容都要填');
      return;
    }
    saveBooks([{ id: `bk_${Date.now().toString(36)}`, name, text }, ...books]);
    setDraftName('');
    setDraftText('');
    toast('已加入我的世界书');
  };

  const importBooks = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      const data = JSON.parse(raw) as unknown;
      const list = Array.isArray(data) ? data : (data as { books?: unknown }).books;
      if (!Array.isArray(list)) throw new Error('格式不对：需要数组或 { books: [...] }');
      const parsed: MineBook[] = [];
      for (const item of list) {
        const row = item as { name?: unknown; text?: unknown; id?: unknown };
        if (typeof row.name !== 'string' || typeof row.text !== 'string') continue;
        parsed.push({
          id: typeof row.id === 'string' ? row.id : `bk_${Date.now().toString(36)}${parsed.length}`,
          name: row.name.slice(0, 60),
          text: row.text,
        });
      }
      if (!parsed.length) throw new Error('没读到有效的世界书');
      saveBooks([...parsed, ...books]);
      toast(`导入 ${parsed.length} 本世界书`);
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败');
    }
  };

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `小手机备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('备份已导出');
  };

  const doImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      importAll(await file.text());
      toast('导入成功，刷新后生效');
      window.setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败');
    }
  };

  return (
    <Screen title="素材仓库" onBack={onClose} className="vault-app">
      <div className="vault-tabs">
        {(
          [
            ['overview', '概览'],
            ['books', '世界书'],
            ['stickers', '表情包'],
            ['preset', '预设'],
            ['backup', '备份'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" className={`vault-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {hint ? <div className="vault-hint">{hint}</div> : null}

      {tab === 'overview' ? (
        <>
          <div className="vault-grid">
            <div className="vault-card">
              <span className="vault-num">{personas.length}</span>
              <span className="vault-label">角色</span>
            </div>
            <div className="vault-card">
              <span className="vault-num">{moments.length}</span>
              <span className="vault-label">朋友圈</span>
            </div>
            <div className="vault-card">
              <span className="vault-num">{books.length + BUILTIN_WORLDBOOKS.length}</span>
              <span className="vault-label">世界书</span>
            </div>
            <div className="vault-card">
              <span className="vault-num">{stickerCount}</span>
              <span className="vault-label">表情</span>
            </div>
            <div className="vault-card">
              <span className="vault-num">{loadingPacks ? '…' : packs.length}</span>
              <span className="vault-label">主题包</span>
            </div>
            <div className="vault-card">
              <span className="vault-num">{conversations.length}</span>
              <span className="vault-label">会话</span>
            </div>
          </div>
          <div className="vault-note">
            所有素材都存在这台设备的浏览器里。换设备或清缓存前，请先到「备份」导出 JSON。
          </div>
        </>
      ) : null}

      {tab === 'books' ? (
        <div className="vault-section">
          <div className="vault-section-head">
            <span>我的世界书（{books.length}）</span>
            <button type="button" className="vault-link" onClick={() => bookFileRef.current?.click()}>
              <Mdi path={mdiUpload} size={15} /> 导入 JSON
            </button>
          </div>
          <input ref={bookFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importBooks(e)} />
          <input
            className="sheet-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="书名，例如 深夜便利店"
          />
          <textarea
            className="sheet-textarea"
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="世界书内容：地点、规则、人物关系等"
          />
          <button type="button" className="primary-btn" onClick={addBook}>
            <Mdi path={mdiPlus} size={16} /> 新增世界书
          </button>
          {books.length === 0 ? (
            <EmptyState title="还没有自己的世界书" hint="导入 JSON 或手动新增一本" />
          ) : (
            books.map((book) => (
              <div key={book.id} className="vault-book">
                <div className="vault-book-main">
                  <div className="vault-book-name">{book.name}</div>
                  <div className="vault-book-text">{book.text.slice(0, 60)}</div>
                </div>
                <button
                  type="button"
                  className="vault-icon"
                  aria-label="删除"
                  onClick={() => saveBooks(books.filter((b) => b.id !== book.id))}
                >
                  <Mdi path={mdiDeleteOutline} size={18} />
                </button>
              </div>
            ))
          )}
          <div className="vault-note">内置世界书 {BUILTIN_WORLDBOOKS.length} 本，创建角色时可勾选。</div>
        </div>
      ) : null}

      {tab === 'stickers' ? (
        <div className="vault-section">
          <div className="vault-section-head">
            <span>{STICKER_PACKS.length} 个系列 · {stickerCount} 张</span>
          </div>
          {STICKER_PACKS.map((pack) => (
            <div key={pack.label} className="vault-pack">
              <div className="vault-pack-name">
                {pack.label}
                <span>{pack.items.length} 张</span>
              </div>
              <div className="vault-pack-grid">
                {pack.items.slice(0, 8).map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={item.name} src={item.url} alt={item.name} loading="lazy" />
                ))}
              </div>
            </div>
          ))}
          <div className="vault-note">聊天时输入 [表情:名称] 就能发表情，或点聊天输入框的表情按钮。</div>
        </div>
      ) : null}

      {tab === 'preset' ? (
        <div className="vault-section">
          <label className="vault-row">
            <span>启用内置剧情预设（MUFY）</span>
            <button
              type="button"
              className={`wx-switch${settings.presetEnabled ? ' on' : ''}`}
              onClick={() => setSettings({ ...settings, presetEnabled: !settings.presetEnabled })}
              aria-label="切换内置预设"
            >
              <i />
            </button>
          </label>
          <div className="vault-section-head">
            <span>我的预设</span>
            <span className="vault-sub">{settings.presetText?.length ?? 0} 字</span>
          </div>
          <textarea
            className="sheet-textarea"
            rows={8}
            value={settings.presetText ?? ''}
            onChange={(e) => setSettings({ ...settings, presetText: e.target.value })}
            placeholder="写下你希望 AI 遵守的写作 / 聊天规则，支持 {{char}} {{user}} 占位符"
          />
          <div className="vault-note">保存即生效，之后每次聊天都会带上这段预设。</div>
        </div>
      ) : null}

      {tab === 'backup' ? (
        <div className="vault-section">
          <button type="button" className="vault-action" onClick={doExport}>
            <Mdi path={mdiDownload} size={20} />
            <span>
              <b>导出全部数据</b>
              <small>角色、聊天、朋友圈、设置、世界书</small>
            </span>
            <Mdi path={mdiChevronRight} size={18} />
          </button>
          <button type="button" className="vault-action" onClick={() => backupFileRef.current?.click()}>
            <Mdi path={mdiUpload} size={20} />
            <span>
              <b>从备份导入</b>
              <small>会覆盖当前浏览器里的数据</small>
            </span>
            <Mdi path={mdiChevronRight} size={18} />
          </button>
          <input ref={backupFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e)} />
          <button
            type="button"
            className="vault-danger"
            onClick={() => {
              if (!window.confirm('清空全部本地数据？建议先导出备份。')) return;
              window.localStorage.clear();
              window.indexedDB.deleteDatabase('starchat-phone-byok');
              window.location.reload();
            }}
          >
            清空全部数据
          </button>
          <div className="vault-note">API Key 只存在本机，不会上传到任何服务器。</div>
        </div>
      ) : null}

      {loadingPacks && tab === 'overview' ? <Spinner /> : null}
    </Screen>
  );
}
