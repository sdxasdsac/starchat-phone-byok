const appName = process.env.NEXT_PUBLIC_APP_NAME || '小手机';

export function GET() {
  const manifest = {
    name: `${appName} · BYOK AI 小手机`,
    short_name: appName,
    description: '自带 API Key 的 AI 小手机：聊天、语音、生图、人设、朋友圈。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#e9f0f8',
    theme_color: '#e9f0f8',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
