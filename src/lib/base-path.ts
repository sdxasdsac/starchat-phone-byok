/**
 * 部署路径前缀：
 * - Vercel / 根目录部署：BASE_PATH = ''
 * - 自建服务器子路径（如 https://www.xingnian.site/phone）：BASE_PATH = '/phone'
 * 构建时通过 NEXT_PUBLIC_BASE_PATH 注入。
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

/** 给 public 下的静态资源地址补上部署前缀（已是 data:/http(s) 或已带前缀的原样返回） */
export function assetPath(path: string | null | undefined): string {
  if (!path) return '';
  if (!path.startsWith('/')) return path;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
