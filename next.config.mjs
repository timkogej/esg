import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so the app can be containerized on a VPS (Docker) without
  // any Vercel-specific runtime features.
  output: 'standalone',
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
