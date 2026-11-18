'use client';

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

export function isUnlocked(): boolean {
  const key = getStoredKey();
  return Boolean(key && isValidKey(key));
}

export function tryUnlock(input: string): boolean {
  const key = normalizeKey(input);
  if (!isValidKey(key)) return false;
  window.localStorage.setItem(STORAGE_KEY, key);
  return true;
}

export function lockAgain(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
