'use client';

import { useEffect } from 'react';

/** 注册 Service Worker，并捕获 beforeinstallprompt 供「主题」页调用 */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 本地 http 或旧浏览器可能不支持，静默失败即可 */
      });
    }
    const handler = (event: Event) => {
      event.preventDefault();
      (window as unknown as { __spInstallPrompt?: Event }).__spInstallPrompt = event;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return null;
}
