import type { Metadata, Viewport } from 'next';
import '@/styles/float-phone/tokens.css';
import '@/styles/float-phone/base.css';
import '@/styles/float-phone/phone-shell.css';
import '@/styles/float-phone/widgets.css';
import './globals.css';
import { PwaRegister } from '@/components/os/PwaRegister';

const appName = process.env.NEXT_PUBLIC_APP_NAME || '小手机';

export const metadata: Metadata = {
  title: `${appName} · BYOK`,
  description: '自带 API Key 的 AI 小手机：聊天、语音、生图、人设、朋友圈、小红薯。Vercel 一键部署 + PWA。',
  applicationName: appName,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#e9f0f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
