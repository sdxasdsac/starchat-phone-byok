/**
 * 日历 app 的本地 KV（移植自参考项目 lib/kv-db.ts 的同步读写接口）。
 * 只保留日历用到的同步 API；底层用 localStorage，不接本项目后端，
 * 与参考项目「数据存在本机」的行为一致。
 */
const PREFIX = 'fp.cal.';

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

function ls(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 兼容参考项目的旧 localStorage 键迁移：本 app 没有历史键，保留空实现 */
export function registerKvMigration(_lsKey: string): void {
  // 移植版从零开始，无需迁移
  void _lsKey;
}

export function kvGet(key: string): string | null {
  return ls()?.getItem(storageKey(key)) ?? null;
}

export function kvSet(key: string, value: string): void {
  ls()?.setItem(storageKey(key), value);
}

export async function kvSetAsync(key: string, value: string): Promise<void> {
  kvSet(key, value);
}

export function kvRemove(key: string): void {
  ls()?.removeItem(storageKey(key));
}

export function kvKeysWithPrefix(prefix: string): string[] {
  const store = ls();
  if (!store) return [];
  const full = storageKey(prefix);
  const out: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith(full)) out.push(k.slice(PREFIX.length));
  }
  return out;
}

export function kvEntries(): Array<{ key: string; value: string }> {
  const store = ls();
  if (!store) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    out.push({ key: k.slice(PREFIX.length), value: store.getItem(k) ?? '' });
  }
  return out;
}
