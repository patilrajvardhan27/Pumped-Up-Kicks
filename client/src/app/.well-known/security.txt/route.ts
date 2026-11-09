import { site } from '@/lib/site';

/*
 * RFC 9116: where to report a vulnerability. Contact falls back to the security
 * page until NEXT_PUBLIC_CONTACT_EMAIL is set. Renew Expires before it passes.
 */
export const dynamic = 'force-static';

export function GET() {
  const contact = site.contactEmail ? `mailto:${site.contactEmail}` : `${site.url}/security`;
  const body = [
    `Contact: ${contact}`,
    'Expires: 2027-11-09T00:00:00.000Z',
    `Policy: ${site.url}/security#disclosure`,
    `Canonical: ${site.url}/.well-known/security.txt`,
    'Preferred-Languages: en',
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
