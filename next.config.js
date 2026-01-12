/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress warnings about dynamic requires in sequelize
    config.ignoreWarnings = [
      { module: /node_modules\/sequelize/ },
      { module: /node_modules\/mariadb/ },
    ];
    
    // For server-side builds, ensure these are treated as external
    // This prevents Next.js from trying to bundle database packages for the client
    if (isServer) {
      // Mark database packages as external (server-only)
      config.externals = config.externals || [];
      config.externals.push({
        sequelize: 'commonjs sequelize',
        mariadb: 'commonjs mariadb',
        bcrypt: 'commonjs bcrypt',
      });
      
      // Don't bundle native modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;

