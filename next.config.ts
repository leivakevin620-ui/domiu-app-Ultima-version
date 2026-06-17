import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        search: '',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        search: '',
      },
    ],
  },
};

export default nextConfig;
