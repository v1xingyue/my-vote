/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  basePath: '/my-vote',
  assetPrefix: '/my-vote',
}

module.exports = nextConfig 