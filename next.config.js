/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep this so Next 16 stops warning (you still use webpack in dev)
  turbopack: {},

  webpack: (config, { isServer }) => {
    // Suppress noisy warnings from Sequelize dynamic requires
    config.ignoreWarnings = [
      { module: /node_modules\/sequelize/ },
      { module: /node_modules\/mariadb/ },
    ];

    if (isServer) {
      // Make sure externals is an array first
      config.externals = config.externals || [];

      // ✅ BETTER: use simple string externals (works in both Webpack + Turbopack)
      config.externals.push("sequelize", "mariadb", "bcrypt");

      // Prevent Next from trying to polyfill Node built-ins
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // (Optional but recommended) Tell Next.js these are server-only packages
  serverExternalPackages: [
    "sequelize",
    "mariadb",
    "bcrypt",
    "@sequelize/mariadb",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;