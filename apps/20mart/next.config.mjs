/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@20mart/ui', '@20mart/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;

