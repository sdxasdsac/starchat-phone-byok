import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 分享页：/share/ 直接输出 public/share.html（同一份内容，便于对外发链接） */
export async function GET() {
  try {
    const html = await readFile(path.join(process.cwd(), 'public', 'share.html'), 'utf8');
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
    });
  } catch {
    return new Response('分享页还没生成', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
