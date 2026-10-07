import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

/** Public pages only. Dates are when each page last changed in substance. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, lastModified: '2026-10-06', changeFrequency: 'monthly', priority: 1 },
    { url: `${site.url}/privacy`, lastModified: '2026-10-06', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site.url}/terms`, lastModified: '2026-10-06', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
