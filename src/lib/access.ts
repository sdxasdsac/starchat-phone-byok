'use client';

// 首次使用密钥（站长在源码里改这一行即可换密钥）
// 用户第一次打开必须输入正确密钥，验证一次后本机记住，之后不再询问。
export const ACCESS_KEY = 'XINGNIAN-2026';

const STORAGE_KEY = 'sp.access.v1';

export function isUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'ok';
}

export function tryUnlock(input: string): boolean {
  const value = input.trim().toUpperCase();
  if (!value || value !== ACCESS_KEY.toUpperCase()) return false;
  window.localStorage.setItem(STORAGE_KEY, 'ok');
  return true;
}

export function lockAgain(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
