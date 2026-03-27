import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    // Suppress optional peer dependency warnings from @reown/appkit-adapter-wagmi
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto': false,
      'porto/internal': false,
      '@metamask/connect-evm': false,
    }

    return config
  }
};

export default nextConfig;
