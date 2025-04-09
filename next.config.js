/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  // Skip type checking during builds for better performance
  typescript: {
    // Dangerously allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
  // Properly configure bundling for server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  // Only include @mastra/core in transpilePackages to avoid conflicts
  transpilePackages: [
    '@mastra/core'
  ],
  webpack: (config, { isServer }) => {
    // Handle Node.js specific modules for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        net: false,
        tls: false,
        worker_threads: false,
        'pino-pretty': false,
        'pino-abstract-transport': false,
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify/browser'),
        crypto: require.resolve('crypto-browserify'),
        events: require.resolve('events/'),
        url: require.resolve('url/'),
        util: require.resolve('util/'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        string_decoder: require.resolve('string_decoder/')
      };
      
      // Add buffer polyfill
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );
      
      // Add process polyfill
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
        })
      );
    }
    
    // Fix for README.md files being imported in node_modules
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
    
    // Handle problems with binary modules and TypeScript declaration files
    config.module.rules.push({
      test: /\.(node|wasm|d\.ts)$/,
      type: 'javascript/auto',
      use: 'null-loader'
    });
    
    // Ignore native modules that cause issues when bundled
    config.module.rules.push({
      test: /\.node$/,
      use: 'null-loader'
    });
    
    if (!isServer) {
      // For client-side, create empty stubs for these modules
      config.resolve.alias = {
        ...config.resolve.alias,
        sqlite3: false,
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false
      };
    }
    
    return config;
  }
}

module.exports = nextConfig 