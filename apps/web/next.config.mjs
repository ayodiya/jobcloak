/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@jobs-app/shared', '@jobs-app/config', '@jobs-app/database'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;