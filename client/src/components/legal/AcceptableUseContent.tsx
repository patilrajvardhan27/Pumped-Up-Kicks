import Link from 'next/link';
import { site } from '@/lib/site';
import { ContactLine, LegalBody, LegalHeader, LegalSection, List, P, Strong } from './prose';

export function AcceptableUseContent() {
  return (
    <>
      <LegalHeader
        title="Acceptable use and academic integrity"
        intro={`${site.name} is a study tool for lectures you are allowed to have. This page explains what that means in practice. It forms part of the terms of service.`}
      />
      <LegalBody>
        <LegalSection id="recordings" title="Which recordings you may upload">
          <List>
            <li>
              <Strong>Recordings your course provides to you</Strong>, such as lecture capture on your learning
              platform, as long as your institution&rsquo;s rules allow you to download and keep them.
            </li>
            <li>
              <Strong>Recordings you made yourself</Strong> with the instructor&rsquo;s permission, or as an approved
              accessibility adjustment.
            </li>
            <li>
              <Strong>Openly licensed material</Strong>, such as lectures published under a Creative Commons licence.
            </li>
          </List>
          <P>
            Do not upload recordings made secretly, recordings you were told not to keep, or anything you could not
            lawfully copy. If you are unsure, ask your instructor first. Rules differ between institutions and
            countries, and following yours is your responsibility.
          </P>
        </LegalSection>

        <LegalSection id="people" title="Respect the people in the recording">
          <List>
            <li>Lectures often capture classmates asking questions. Only upload what you need for your own study.</li>
            <li>Never share transcripts, exports or clips in a way that identifies other students.</li>
            <li>Do not upload private conversations, office hours, tutorials or meetings without everyone&rsquo;s consent.</li>
          </List>
        </LegalSection>

        <LegalSection id="integrity" title="Using AI study tools fairly">
          <P>Revision notes, key terms and quizzes are built to help you learn the material, not to hand in.</P>
          <List>
            <li>
              <Strong>Good use:</Strong> revising before an exam, finding where a topic was explained, checking your
              understanding with a practice quiz, catching up on a lecture you missed.
            </li>
            <li>
              <Strong>Not allowed:</Strong> submitting generated text as your own work, using the service during an
              exam or assessment that forbids it, or sharing generated answers to graded tasks.
            </li>
          </List>
          <P>
            Your institution&rsquo;s academic integrity policy always comes first. Where it requires you to declare AI
            use, do so. Answers can be wrong, so check the cited moment in the lecture before relying on one.
          </P>
        </LegalSection>

        <LegalSection id="service" title="Protecting the service">
          <List>
            <li>Use only your own account, and do not share it or sell access to it.</li>
            <li>Do not try to get around usage limits, rate limits or sign-in, or automate requests at scale.</li>
            <li>Do not probe for vulnerabilities outside the rules on our security page, or access data that is not yours.</li>
            <li>Do not upload malware, or content that is illegal, hateful or sexually explicit.</li>
          </List>
        </LegalSection>

        <LegalSection id="enforcement" title="What happens if these rules are broken">
          <P>
            We may remove content, limit features, or suspend or close an account, depending on how serious the
            problem is. Where we can, we will tell you why and give you a chance to respond. Rights holders can ask for
            content to be removed using the route in the{' '}
            <Link href="/terms#copyright" className="text-link-blue underline">
              terms of service
            </Link>
            .
          </P>
        </LegalSection>

        <LegalSection id="report" title="Report a problem">
          <ContactLine />
        </LegalSection>
      </LegalBody>
    </>
  );
}
