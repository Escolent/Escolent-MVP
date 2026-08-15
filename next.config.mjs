import withPWAInit from "@ducanh2912/next-pwa";

// PWA / service worker setup (Workbox under the hood).
// Task 1.1 wires up generation + the default Workbox runtime-caching strategy
// (cache-first for static assets, network-first for everything else).
// Task 18.1 layers on the offline-sync-specific caching rules (background sync
// for queued responses, network-first-with-cache-fallback for API routes).
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Service workers add noise to hot-reload during local development.
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
