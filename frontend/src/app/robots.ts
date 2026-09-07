import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api',
        '/auth',
        '/*/auth',
        '/dashboard',
        '/*/dashboard',
        '/login',
        '/*/login',
        '/register',
        '/*/register',
        '/forgot-password',
        '/*/forgot-password',
        '/reset-password',
        '/*/reset-password',
        '/verify-email',
        '/*/verify-email',
        '/unauthorized',
        '/*/unauthorized',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}