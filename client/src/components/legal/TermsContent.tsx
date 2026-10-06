import { site } from '@/lib/site';
import { ContactLine, LegalBody, LegalHeader, LegalSection, List, Operator, P, Strong } from './prose';

export function TermsContent() {
  return (
    <>
      <LegalHeader
        title="Terms of service"
        intro={`These are the rules for using ${site.name}. By creating an account or using the service you agree to them.`}
      />
      <LegalBody>
        <LegalSection id="service" title="The service">
          <P>
            {site.name} turns lecture recordings you upload into searchable transcripts and answers your questions
            about them, citing the moments they came from. <Operator /> provides it.
          </P>
        </LegalSection>

        <LegalSection id="account" title="Your account">
          <P>
            You are responsible for what happens under your account and for keeping your sign-in details private. Give
            us accurate information, and tell us if you think someone else has access.
          </P>
        </LegalSection>

        <LegalSection id="content" title="Your content">
          <P>
            You keep ownership of what you upload. You give us permission to store it and to process it (transcribe,
            index, search and send excerpts to an AI model) only to run the service for you.
          </P>
          <P>
            <Strong>You must have the right to upload it.</Strong> Recordings of classes are often owned by the
            instructor or the school, and recording other people can need their consent. Follow your
            institution&rsquo;s rules and the law where you are. Do not upload anything you are not allowed to copy or
            share.
          </P>
        </LegalSection>

        <LegalSection id="use" title="Acceptable use">
          <P>You agree not to:</P>
          <List>
            <li>upload content that is illegal, infringes someone else&rsquo;s rights, or invades their privacy;</li>
            <li>try to get around usage limits, rate limits or sign-in, or use the service to attack others;</li>
            <li>probe, copy or reverse engineer the service, or access data that is not yours;</li>
            <li>use the service in a way that breaks your school&rsquo;s academic integrity rules.</li>
          </List>
        </LegalSection>

        <LegalSection id="ai" title="AI answers can be wrong">
          <P>
            Answers are written by an AI model from excerpts of your lectures. They can be incomplete or mistaken.
            Check the cited timestamp before you rely on an answer, and do not treat it as professional, medical,
            legal or academic advice.
          </P>
        </LegalSection>

        <LegalSection id="limits" title="Plans and limits">
          <P>
            Each plan has a monthly usage allowance, measured in the cost of the AI answers you request, plus limits on
            upload size and request speed. We may change plans and limits. If paid features are introduced, we will
            show the price before you are charged.
          </P>
        </LegalSection>

        <LegalSection id="availability" title="Availability and changes">
          <P>
            We work to keep the service running but do not promise it will always be available or error free. We may
            change or remove features, and we will try to give notice of changes that affect you.
          </P>
        </LegalSection>

        <LegalSection id="ending" title="Ending your use">
          <P>
            You can delete your lectures and stop using the service at any time. We may suspend or end access if you
            break these terms or put the service or other people at risk.
          </P>
        </LegalSection>

        <LegalSection id="copyright" title="Copyright complaints">
          <P>
            If you believe content on the service infringes your rights, tell us which content and why, and we will
            review it and remove it where appropriate.
          </P>
          <ContactLine />
        </LegalSection>

        <LegalSection id="liability" title="Warranties and liability">
          <P>
            The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect
            or consequential loss, or for loss of data or study results, and our total liability is limited to what you
            paid us in the last 12 months. Nothing here limits rights you have by law that cannot be limited.
          </P>
        </LegalSection>

        <LegalSection id="changes" title="Changes to these terms">
          <P>
            We may update these terms. The date at the top shows the latest version, and continuing to use the service
            after a change means you accept it.
          </P>
        </LegalSection>

        <LegalSection id="contact" title="Contact">
          <ContactLine />
        </LegalSection>
      </LegalBody>
    </>
  );
}
