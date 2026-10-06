import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // The workspace is behind sign-in and has nothing for a search engine to read.
    rules: { userAgent: '*', allow: '/', disallow: ['/app', '/ingest/'] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
