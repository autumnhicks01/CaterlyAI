let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      allowedOrigins: ['localhost:3000', 'cateringai-six.vercel.app'],
      bodySizeLimit: '10mb'
    },
  },
  // Let Node.js handle these packages natively instead of bundling them
  serverExternalPackages: [
    '@libsql/client',
    '@libsql/hrana-client',
    '@libsql/isomorphic-fetch',
    '@libsql/isomorphic-ws',
    '@libsql/win32-x64-msvc',
    '@libsql/core',
    'libsql',
    'pino-pretty',
    'pino-abstract-transport',
    'sonic-boom'
  ],
  // Transpile these packages to ensure proper bundling
  transpilePackages: [
    '@mastra/core'
  ],
  // Set environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_GOOGLE_PLACES_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Add redirects as needed
  async redirects() {
    return [];
  },
  // Add headers if needed
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Add webpack configuration to handle problematic files and provide fallbacks for Node.js modules
  webpack: (config, { isServer }) => {
    // Handle README.md files
    config.module.rules.push({
      test: /\.md$/,
      type: 'javascript/auto',
      use: 'null-loader'
    });
    
    // Handle LICENSE files
    config.module.rules.push({
      test: /LICENSE$/,
      type: 'javascript/auto',
      use: 'null-loader'
    });

    // Handle binary .node files
    config.module.rules.push({
      test: /\.node$/,
      loader: 'node-loader',
    });

    // Handle TypeScript declaration files
    config.module.rules.push({
      test: /\.d\.ts$/,
      type: 'javascript/auto',
      use: 'null-loader'
    });
    
    // Provide fallbacks for Node.js built-in modules on the client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        net: false,
        tls: false,
        worker_threads: false,
        child_process: false
      };
    }
    
    return config;
  }
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig;
