import Link from 'next/link';
import { site } from '@/lib/site';
import { ContactLine, LegalBody, LegalHeader, LegalSection, List, Operator, P, Strong } from './prose';

export function PrivacyContent() {
  return (
    <>
      <LegalHeader
        title="Privacy policy"
        intro={`This explains what ${site.name} collects when you use it, why, who else sees it, and the choices you have.`}
      />
      <LegalBody>
        <LegalSection id="who" title="Who is responsible">
          <P>
            <Operator /> runs {site.name} (the service) and decides how your data is used.
          </P>
        </LegalSection>

        <LegalSection id="collect" title="What we collect">
          <List>
            <li>
              <Strong>Your account.</Strong> Sign-in is handled by Clerk. We keep your account id, email address and
              display name.
            </li>
            <li>
              <Strong>Your lectures.</Strong> The video files you upload, the transcript made from them, and a search
              index of that transcript (lists of numbers that let us find passages by meaning).
            </li>
            <li>
              <Strong>Your questions and answers.</Strong> Your chats, the excerpts each answer cited, and the tokens
              and cost each answer used.
            </li>
            <li>
              <Strong>Usage.</Strong> How many questions you have asked this month, how many were answered from cache,
              and your spend against your plan limit.
            </li>
            <li>
              <Strong>Technical data.</Strong> Your IP address, request logs and error logs, kept by us and our
              hosting provider for security and debugging. Errors you see carry a short reference so we can find the
              matching log entry without asking for anything else.
            </li>
            <li>
              <Strong>Analytics, only if you accept.</Strong> Pages you visit, and a few named actions such as
              &ldquo;question asked&rdquo; or &ldquo;lecture uploaded&rdquo;, with your browser, device and
              approximate country. We never send lecture titles, transcripts or the text of your questions and
              answers to analytics, and screen recording is switched off.
            </li>
          </List>
        </LegalSection>

        <LegalSection id="use" title="How we use it">
          <List>
            <li>To transcribe your recordings, index them and answer your questions.</li>
            <li>To apply the usage limits of your plan and to keep the service secure.</li>
            <li>To understand which features are used and fix what is broken, if you accepted analytics.</li>
          </List>
          <P>
            We do not sell your data, and we do not use your lectures or chats to train AI models. Answers are
            written automatically, but nothing about you is decided automatically: no grades, no eligibility, no
            profiling.
          </P>
        </LegalSection>

        <LegalSection id="bases" title="Our legal bases">
          <List>
            <li>
              <Strong>To provide the service you asked for</Strong>: your account, lectures, transcripts and chats.
            </li>
            <li>
              <Strong>Legitimate interests</Strong>: security logs, abuse prevention and usage limits.
            </li>
            <li>
              <Strong>Consent</Strong>: analytics. You can withdraw it at any time.
            </li>
          </List>
        </LegalSection>

        <LegalSection id="sharing" title="Who else receives it">
          <P>Depending on how the service is deployed, these providers process data on our behalf:</P>
          <List>
            <li>
              <Strong>Clerk</Strong> handles sign-in and holds your account details.
            </li>
            <li>
              <Strong>Anthropic</Strong> receives your question and the transcript text needed to answer it, so Claude
              can write the answer: a few matching excerpts for a typed question, or the selected lecture&rsquo;s
              transcript for a study tool such as revision notes. It does not receive your video or audio, and under
              its commercial terms it does not train on this data.
            </li>
            <li>
              <Strong>PostHog</Strong> receives analytics events, only if you accepted.
            </li>
            <li>
              <Strong>Hosting, database and file storage providers</Strong> keep your videos, transcripts and chats.
              If transcription runs on a cloud GPU worker, that provider briefly processes your audio.
            </li>
          </List>
          <P>
            Some of these providers are based in the United States, so your data may be processed outside your
            country. Where the law requires it, transfers rely on safeguards such as standard contractual clauses.
            We may also disclose data when the law requires it.
          </P>
        </LegalSection>

        <LegalSection id="cookies" title="Cookies and local storage">
          <P>
            Sign-in cookies and a few local storage entries are needed for the workspace to work. Analytics cookies are
            set only if you accept them, and &ldquo;Cookie settings&rdquo; in the footer changes your choice at any
            time. The{' '}
            <Link href="/cookies" className="text-link-blue underline">
              cookie policy
            </Link>{' '}
            lists every one.
          </P>
        </LegalSection>

        <LegalSection id="retention" title="How long we keep it">
          <P>
            Videos, transcripts, search indexes and chats stay until you delete them. Deleting a lecture removes the
            file, its transcript, its index entries and the chats about it. Account details stay while your account is
            open. Deleting your account from <Strong>Your data</Strong> in the workspace removes all of it at once,
            apart from anything the law requires us to keep. Backups can hold copies for up to 30 days afterwards, and
            security logs are kept for up to 90 days.
          </P>
        </LegalSection>

        <LegalSection id="rights" title="Your rights">
          <P>
            Depending on where you live, you can ask to see, correct, export or delete your data, object to how it is
            used, and withdraw consent you gave. You can download or delete everything yourself from{' '}
            <Strong>Your data</Strong> in the workspace; for anything else, contact us. You can also complain to your
            local data protection authority.
          </P>
        </LegalSection>

        <LegalSection id="security" title="Security">
          <P>
            Traffic is encrypted in transit. Every database query is limited to the signed-in account, video links are
            signed and expire, and idle sessions sign out after 30 minutes. No system is perfectly secure, so keep your
            sign-in details private and tell us if you suspect a problem. Details are on the{' '}
            <Link href="/security" className="text-link-blue underline">
              security page
            </Link>
            .
          </P>
        </LegalSection>

        <LegalSection id="children" title="Children">
          <P>The service is not directed to children under 13, and we do not knowingly collect their data.</P>
        </LegalSection>

        <LegalSection id="changes" title="Changes to this policy">
          <P>
            When we change this policy in a way that matters, we will update the date at the top and, where we can,
            tell you in the service.
          </P>
        </LegalSection>

        <LegalSection id="contact" title="Contact">
          <ContactLine />
        </LegalSection>
      </LegalBody>
    </>
  );
}
