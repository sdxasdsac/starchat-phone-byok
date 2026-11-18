'use client';

import { claimKey, isClaimed } from './claim-db';
import { getDeviceId } from './device-id';

// 一次性密钥校验服务（部署在 starchat 服务器上的小接口）
const ACCESS_API = process.env.NEXT_PUBLIC_ACCESS_API || 'https://www.xingnian.site/api/access-key';

// 每人一个专属访问密钥：XN-XXXX-XXXX-CCCC
// 前两段随机，最后一段是校验码。密钥由 scripts/gen-keys.mjs 批量生成。
// 注意：这是前端门槛，能挡住普通用户；如果需要“一钥一人、不可伪造”，必须加服务端校验。
const SALT = 'XN-2026-11-18-7f3c9a';
const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
const STORAGE_KEY = 'sp.access.v1';

function checksum(body: string): string {
  const input = `${body}|${SALT}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += CHARS[hash & 31];
    hash >>>= 5;
  }
  return out;
}

export function normalizeKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[—–－]/g, '-')
    .replace(/\s+/g, '');
}

export function isValidKey(input: string): boolean {
  const key = normalizeKey(input);
  const match = /^XN-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(key);
  if (!match) return false;
  const body = `XN${match[1]}${match[2]}`;
  return checksum(body) === match[3];
}

export function getStoredKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function keyHash(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function isUnlocked(): boolean {
  const key = getStoredKey();
  return Boolean(key && isValidKey(key));
}

export type UnlockResult = { ok: true } | { ok: false; reason: 'invalid' | 'used' | 'network' };

/** 云端一次性校验 + 本机兜底：同一密钥被别的设备激活过就拒绝 */
export async function tryUnlock(input: string): Promise<UnlockResult> {
  const key = normalizeKey(input);
  if (!isValidKey(key)) return { ok: false, reason: 'invalid' };

  const device = await getDeviceId();
  try {
    const res = await fetch(ACCESS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, device }),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
    if (!res.ok || !data.ok) {
      if (data.reason === 'used') return { ok: false, reason: 'used' };
      if (data.reason === 'invalid') return { ok: false, reason: 'invalid' };
      return { ok: false, reason: 'network' };
    }
  } catch {
    return { ok: false, reason: 'network' };
  }

  const hash = keyHash(key);
  const stored = getStoredKey();
  const claimed = await isClaimed(hash);
  if (claimed && stored !== key) return { ok: false, reason: 'used' };

  if (!claimed) await claimKey(hash);
  window.localStorage.setItem(STORAGE_KEY, key);
  return { ok: true };
}

export function lockAgain(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
