import type { MetadataRoute } from 'next';
import { API_BASE_URL, SITE_URL } from '@/lib/deployment-urls';

const API_TIMEOUT_MS = 5_000;

function fetchSitemapData(path: string) {
  return fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

function alternates(path: string) {
  return {
    languages: {
      ar: `${SITE_URL}/ar${path}`,
      en: `${SITE_URL}/en${path}`,
      'x-default': `${SITE_URL}/ar${path}`,
    },
  };
}

const STATIC_ROUTES = [
  { path: '', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/courses', priority: 0.9, changeFrequency: 'daily' as const },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' as const },
  { path: '/verify-certificate', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/faq', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/refund-policy', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/cookies', priority: 0.2, changeFrequency: 'yearly' as const },
  { path: '/join-as-instructor', priority: 0.6, changeFrequency: 'monthly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const lastModified = new Date();

  for (const route of STATIC_ROUTES) {
    entries.push({
      url: `${SITE_URL}/ar${route.path}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: alternates(route.path),
    });
  }

  // Public blog posts
  try {
    const res = await fetchSitemapData('/blog?page=1&pageSize=500');
    if (res.ok) {
      const data = await res.json();
      const items = (data?.items ?? []) as { slug?: string; publishedAt?: string }[];
      for (const post of items) {
        if (!post.slug) continue;
        const path = `/blog/${post.slug}`;
        entries.push({
          url: `${SITE_URL}/ar${path}`,
          lastModified: post.publishedAt ? new Date(post.publishedAt) : lastModified,
          changeFrequency: 'monthly',
          priority: 0.7,
          alternates: alternates(path),
        });
      }
    }
  } catch (error) {
    console.warn('Sitemap blog entries unavailable; using static routes only.', error);
  }

  // Public courses
  try {
    const res = await fetchSitemapData('/courses');
    if (res.ok) {
      const data = (await res.json()) as { id?: string }[];
      if (Array.isArray(data)) {
        for (const course of data) {
          if (!course.id) continue;
          const path = `/courses/${course.id}`;
          entries.push({
            url: `${SITE_URL}/ar${path}`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: alternates(path),
          });
        }
      }
    }
  } catch (error) {
    console.warn('Sitemap course entries unavailable; using static routes only.', error);
  }

  return entries;
}