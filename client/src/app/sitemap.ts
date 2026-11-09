import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

/** Public pages only. Dates are when each page last changed in substance. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, lastModified: site.legalUpdatedIso, changeFrequency: 'monthly', priority: 1 },
    { url: `${site.url}/privacy`, lastModified: site.legalUpdatedIso, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site.url}/terms`, lastModified: site.legalUpdatedIso, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
