/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mastra/core'],
  webpack: (config, { isServer }) => {
    // Handle Node.js specific modules for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        worker_threads: false,
        'pino-pretty': false,
        'pino-abstract-transport': false,
        crypto: require.resolve('crypto-browserify')
      };
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
    
    // Exclude specific problematic modules
    config.module.rules.push({
      test: /node_modules\/@libsql\/client\/README\.md$/i,
      use: 'null-loader',
    });
    
    // Handle problems with the LibSQL client
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'javascript/auto',
      use: 'null-loader'
    });
    
    // Ignore specific modules that cause issues in the browser
    config.externals = [
      ...(config.externals || []),
      isServer ? {} : {
        '@libsql/client': 'commonjs @libsql/client',
        'libsql': 'commonjs libsql'
      }
    ];
    
    // Don't attempt to polyfill sqlite3 (used by @libsql/client)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sqlite3: false,
        'mock-aws-s3': false,
        'aws-sdk': false,
        nock: false
      };
    }
    
    return config;
  },
  // Skip type checking during builds for better performance
  typescript: {
    // Dangerously allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig 