import { site } from '@/lib/site';
import { ContactLine, LegalBody, LegalHeader, LegalSection, List, P, Strong } from './prose';

export function SecurityContent() {
  return (
    <>
      <LegalHeader
        title="Security"
        intro={`How ${site.name} protects your account and your lectures, what you can do to help, and how to report a vulnerability.`}
      />
      <LegalBody>
        <LegalSection id="account" title="Your account and sessions">
          <List>
            <li>Sign-in is handled by Clerk. We never see or store your password.</li>
            <li>
              Sessions use short-lived tokens that expire after about a minute and are renewed only while you are
              active. After 30 minutes without activity in any tab, you are signed out.
            </li>
            <li>Signing out ends the session on the server, not just in your browser.</li>
            <li>Each sign-in starts a fresh session, so an old session id cannot be reused to take over a new one.</li>
          </List>
        </LegalSection>

        <LegalSection id="data" title="Your lectures and chats">
          <List>
            <li>
              Every request is checked against your account before any data is returned. Lectures, transcripts and
              chats belonging to someone else return &ldquo;not found&rdquo;.
            </li>
            <li>Video links are signed, tied to your account and expire after an hour.</li>
            <li>Uploads are limited to video file types and a maximum size, checked again after upload.</li>
            <li>Deleting a lecture or your account deletes the file, transcript, search index and chats.</li>
          </List>
        </LegalSection>

        <LegalSection id="transport" title="In transit and in the browser">
          <List>
            <li>All traffic uses HTTPS, and browsers are told to refuse plain HTTP for a year (HSTS).</li>
            <li>
              A content security policy limits which sites the app may load code from or send data to, and the app
              cannot be embedded in another site.
            </li>
            <li>Error messages never include internal details. Each error carries a reference you can quote to us.</li>
            <li>Requests that cost money are rate limited per account.</li>
          </List>
        </LegalSection>

        <LegalSection id="you" title="What you can do">
          <List>
            <li>Use a strong, unique password, or sign in with a provider that has two-step verification.</li>
            <li>Sign out on shared or library computers.</li>
            <li>Tell us straight away if you see activity you do not recognise.</li>
          </List>
        </LegalSection>

        <LegalSection id="disclosure" title="Reporting a vulnerability">
          <P>
            If you find a security problem, please tell us privately and give us reasonable time to fix it before
            telling anyone else. Include the steps to reproduce it and what you think the impact is.
          </P>
          <P>
            <Strong>Please do not</Strong> access or change other people&rsquo;s data, run denial-of-service or
            automated scanning at volume, or use social engineering. Test only against your own account. If you follow
            these rules and act in good faith, we will not pursue legal action against you for your research.
          </P>
          <ContactLine />
        </LegalSection>
      </LegalBody>
    </>
  );
}
