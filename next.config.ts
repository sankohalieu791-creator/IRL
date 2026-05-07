const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true, // Disabled for now
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        }
      }
    },
    {
      urlPattern: /^https:\/\/.+\.(png|gif|jpg|jpeg|svg|webp)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        }
      }
    }
  ],
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ["!noprecache/**/*"],
  fallbacks: {
    image: "/icon-192.png",
    document: "/offline.html"
  },
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  dynamicStartUrl: false,
  cacheStartUrl: true
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {}
}

module.exports = withPWA(nextConfig)