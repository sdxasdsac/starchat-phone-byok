const appName = process.env.NEXT_PUBLIC_APP_NAME || '小手机';
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
const p = (path: string) => `${basePath}${path}`;

export function GET() {
  const manifest = {
    id: p('/'),
    name: `${appName} · BYOK AI 小手机`,
    short_name: appName,
    description: '自带 API Key 的 AI 小手机：聊天、语音、生图、人设、朋友圈。',
    start_url: p('/'),
    scope: p('/'),
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#e9f0f8',
    theme_color: '#e9f0f8',
    lang: 'zh-CN',
    categories: ['social', 'entertainment', 'lifestyle'],
    icons: [
      {
        src: p('/icons/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: p('/icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: p('/icons/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: '聊天', url: p('/?app=chat') },
      { name: '微信', url: p('/?app=wechat') },
      { name: '素材仓库', url: p('/?app=materials') },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
