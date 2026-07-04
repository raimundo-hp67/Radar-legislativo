import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// CSP: React/Next requiere inline scripts/styles; 'unsafe-eval' solo en dev
// (React Refresh). img-src incluye data: por el logo personalizable.
const contentSecurityPolicy = [
  'default-src \'self\'',
  `script-src 'self' 'unsafe-inline'${isDev ? ' \'unsafe-eval\'' : ''}`,
  'style-src \'self\' \'unsafe-inline\'',
  'img-src \'self\' data: blob:',
  'font-src \'self\' data:',
  'connect-src \'self\'',
  'frame-ancestors \'none\'',
  'base-uri \'self\'',
  'form-action \'self\'',
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
