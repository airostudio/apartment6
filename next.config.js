/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// Static assets are revalidated on every load (ETag) so a deploy is never
// hidden behind a day-long browser cache.
const revalidate = [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }];

module.exports = {
  reactStrictMode: false, // pages run legacy DOM scripts; double-invoked effects would re-bind them
  trailingSlash: false,
  experimental: { globalNotFound: true },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/js/:path*', headers: revalidate },
      { source: '/css/:path*', headers: revalidate },
    ];
  },

  async rewrites() {
    return [
      // Keep the original /public/<image> URLs working (images now live in Next's public/ root).
      { source: '/public/:path*', destination: '/:path*' },
      // Stay within Vercel's serverless function limit: these are served by other handlers.
      { source: '/api/availability', destination: '/api/bookings?action=availability' },
      { source: '/api/ical-feeds', destination: '/api/blocked-dates?resource=ical-feeds' },
      { source: '/api/send-test-email', destination: '/api/booking-email?action=test' },
    ];
  },

  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/index', destination: '/', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/search', destination: '/property', permanent: true },
      { source: '/admin.html', destination: '/admin/login', permanent: true },
      { source: '/login', destination: '/admin/login', permanent: false },
      { source: '/admin', destination: '/admin/index', permanent: false },
      // Legacy .html URLs (links, bookmarks, in-page navigation) -> clean URLs
      { source: '/:page.html', destination: '/:page', permanent: true },
      { source: '/admin/:page.html', destination: '/admin/:page', permanent: true },
    ];
  },
};
