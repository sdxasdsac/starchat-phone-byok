/** @type {import('next').NextConfig} */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

const nextConfig = {
  reactStrictMode: true,
  // 部署在子路径（例如 https://www.xingnian.site/phone）时设置 NEXT_PUBLIC_BASE_PATH=/phone；
  // Vercel 根目录部署时留空即可。
  basePath: basePath || undefined,
  // 子路径部署时统一成 /phone/，这样 Service Worker 的 scope 能覆盖整个应用
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // 所有 API 都在服务端（Vercel Serverless / 自建 Node）里运行。
  experimental: {
    optimizePackageImports: ['@mdi/js'],
  },
};

export default nextConfig;
