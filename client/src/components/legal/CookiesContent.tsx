import Link from 'next/link';
import { site } from '@/lib/site';
import { ContactLine, LegalBody, LegalHeader, LegalSection, P, Strong } from './prose';

interface Entry {
  name: string;
  kind: 'Cookie' | 'Local storage';
  setBy: string;
  purpose: string;
  lasts: string;
}

const ESSENTIAL: Entry[] = [
  { name: '__session', kind: 'Cookie', setBy: 'Clerk', purpose: 'Proves you are signed in. Refreshed about every minute while the tab is open.', lasts: 'About 1 minute' },
  { name: '__client_uat', kind: 'Cookie', setBy: 'Clerk', purpose: 'Tells the app when you last signed in or out, so every tab agrees.', lasts: 'Up to 1 year' },
  { name: '__client', kind: 'Cookie', setBy: 'Clerk (its own domain)', purpose: 'Keeps your sign-in. HttpOnly and Secure: page scripts cannot read it.', lasts: 'Until you sign out or the session ends' },
  { name: 'puk-consent-v1', kind: 'Local storage', setBy: site.name, purpose: 'Remembers whether you accepted analytics.', lasts: 'Until you clear it' },
  { name: 'puk-last-active-v1', kind: 'Local storage', setBy: site.name, purpose: 'Time of your last click or key press, so idle sessions sign out after 30 minutes.', lasts: 'Cleared on sign-out' },
  { name: 'puk-active-subject-v1', kind: 'Local storage', setBy: site.name, purpose: 'Reopens the subject you were last working in.', lasts: 'Cleared on sign-out' },
  { name: 'puk-sidebar-collapsed-v1', kind: 'Local storage', setBy: site.name, purpose: 'Remembers whether you collapsed the sidebar.', lasts: 'Cleared on sign-out' },
];

const OPTIONAL: Entry[] = [
  { name: 'ph_<project>_posthog', kind: 'Cookie', setBy: 'PostHog', purpose: 'An anonymous id that lets repeat visits be counted together.', lasts: 'Up to 1 year, or until you decline' },
];

function Table({ caption, rows }: { caption: string; rows: Entry[] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-body-xs text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline text-ink">
            {['Name', 'Type', 'Set by', 'Purpose', 'Lasts'].map((heading) => (
              <th key={heading} scope="col" className="py-2 pr-3 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-hairline-soft align-top">
              <td className="py-2 pr-3 font-mono text-code-xs text-ink">{row.name}</td>
              <td className="py-2 pr-3">{row.kind}</td>
              <td className="py-2 pr-3">{row.setBy}</td>
              <td className="py-2 pr-3">{row.purpose}</td>
              <td className="py-2 pr-3">{row.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CookiesContent() {
  return (
    <>
      <LegalHeader
        title="Cookie policy"
        intro={`Every cookie and browser storage entry ${site.name} uses, what it is for, and how to switch the optional ones off.`}
      />
      <LegalBody>
        <LegalSection id="essential" title="Needed for the service to work">
          <P>
            These are set only on the workspace pages, where you sign in. The landing and legal pages set none of
            them. You cannot turn them off and still use the workspace.
          </P>
          <Table caption="Essential cookies and storage" rows={ESSENTIAL} />
        </LegalSection>

        <LegalSection id="optional" title="Only if you accept analytics">
          <P>
            Nothing here is set until you choose &ldquo;Accept&rdquo; on the cookie banner. Analytics never records
            your screen, your lecture titles, transcripts or the text of your questions.
          </P>
          <Table caption="Optional cookies" rows={OPTIONAL} />
        </LegalSection>

        <LegalSection id="choices" title="Your choices">
          <P>
            Use <Strong>Cookie settings</Strong> in the footer to change your mind at any time. Declining stops
            analytics at once and deletes its id from your browser. You can also clear site data in your browser
            settings, which signs you out.
          </P>
          <P>
            We do not use advertising cookies, and we do not sell or share data for advertising. See the{' '}
            <Link href="/privacy" className="text-link-blue underline">
              privacy policy
            </Link>{' '}
            for everything else we collect.
          </P>
        </LegalSection>

        <LegalSection id="contact" title="Contact">
          <ContactLine />
        </LegalSection>
      </LegalBody>
    </>
  );
}
