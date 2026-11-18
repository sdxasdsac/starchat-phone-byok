/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // 所有 API 都在 Vercel Serverless Function 里运行；这里只做静态资源优化开关。
  experimental: {
    optimizePackageImports: ['@mdi/js'],
  },
};

export default nextConfig;
