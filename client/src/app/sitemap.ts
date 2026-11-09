import type { MetadataRoute } from 'next';
import { LEGAL_PAGES } from '@/lib/legal';
import { site } from '@/lib/site';

/** Public pages only. Dates are when each page last changed in substance. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, lastModified: '2026-11-09', changeFrequency: 'monthly', priority: 1 },
    ...LEGAL_PAGES.map((page) => ({
      url: `${site.url}${page.path}`,
      lastModified: site.legalUpdatedIso,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
