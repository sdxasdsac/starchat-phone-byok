'use client';

// 本机设备 id：存 localStorage，同时备份到 IndexedDB。
// 清 localStorage 不会变；只有清空全部站点数据才会变。
import { getMeta, setMeta } from './claim-db';

const LS_KEY = 'sp.device.v1';
const META_KEY = 'device';

function randomId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return `dev_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function getDeviceId(): Promise<string> {
  const local = window.localStorage.getItem(LS_KEY);
  if (local) {
    void setMeta(META_KEY, local);
    return local;
  }
  const stored = await getMeta(META_KEY);
  if (stored) {
    window.localStorage.setItem(LS_KEY, stored);
    return stored;
  }
  const id = randomId();
  window.localStorage.setItem(LS_KEY, id);
  await setMeta(META_KEY, id);
  return id;
}
