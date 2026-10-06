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
              <Strong>Technical data.</Strong> Your IP address and request logs, kept by our hosting provider for
              security and debugging.
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
            We do not sell your data, and we do not use your lectures or chats to train AI models.
          </P>
        </LegalSection>

        <LegalSection id="sharing" title="Who else receives it">
          <P>Depending on how the service is deployed, these providers process data on our behalf:</P>
          <List>
            <li>
              <Strong>Clerk</Strong> handles sign-in and holds your account details.
            </li>
            <li>
              <Strong>Anthropic</Strong> receives your question and the few transcript excerpts that matched it, so
              Claude can write the answer. It does not receive your video, your audio or the full transcript.
            </li>
            <li>
              <Strong>PostHog</Strong> receives analytics events, only if you accepted.
            </li>
            <li>
              <Strong>Hosting, database and file storage providers</Strong> keep your videos, transcripts and chats.
              If transcription runs on a cloud GPU worker, that provider briefly processes your audio.
            </li>
          </List>
          <P>We may also disclose data when the law requires it.</P>
        </LegalSection>

        <LegalSection id="cookies" title="Cookies and local storage">
          <List>
            <li>
              <Strong>Always on, needed to work.</Strong> Clerk&rsquo;s session cookies keep you signed in. A small
              entry in your browser&rsquo;s local storage remembers your analytics choice.
            </li>
            <li>
              <Strong>Only if you accept.</Strong> PostHog stores an anonymous id in your browser so repeat visits
              can be counted together.
            </li>
          </List>
          <P>
            You can change your mind at any time with &ldquo;Cookie settings&rdquo; in the footer. Declining stops
            analytics and clears the analytics id.
          </P>
        </LegalSection>

        <LegalSection id="retention" title="How long we keep it">
          <P>
            Videos, transcripts, search indexes and chats stay until you delete them. Deleting a lecture removes the
            file, its transcript, its index entries and the chats about it. Account details stay while your account is
            open. Ask us to delete your account and we will remove your data, apart from anything the law requires us
            to keep. Backups can hold copies for a short time afterwards.
          </P>
        </LegalSection>

        <LegalSection id="rights" title="Your rights">
          <P>
            Depending on where you live, you can ask to see, correct, export or delete your data, object to how it is
            used, and withdraw consent you gave. You can also complain to your local data protection authority.
          </P>
        </LegalSection>

        <LegalSection id="security" title="Security">
          <P>
            Traffic is encrypted in transit. Every database query is limited to the signed-in account, and video links
            are signed and expire. No system is perfectly secure, so keep your sign-in details private and tell us if
            you suspect a problem.
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
