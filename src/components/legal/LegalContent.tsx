import { Link } from "@tanstack/react-router";
import { PublicSection } from "@/components/shell/PublicPage";

export function TermsContent() {
  return (
    <>
      <PublicSection title="1. Agreement and CARCC">
        <p>
          These Terms govern the OCADE public website and every OCADE service that becomes available
          under the CARCC brand. CARCC is the independent technology enterprise, business brand and
          venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC and creator of
          OCADE.
        </p>
        <p>
          These Terms deliberately use the public CARCC brand identity and do not describe a Private
          Limited Company, LLP, listed company or other legal form unless that status is separately
          established and published. No wording on this website creates a legal form, share class or
          corporate status that does not otherwise exist under applicable law.
        </p>
      </PublicSection>

      <PublicSection title="2. Effective date, founding date and launch">
        <p>
          These Terms are effective from 25 August 2026 for the public website and any OCADE service
          already made available. CARCC records 28 August 2026 as its formal founding date and the
          scheduled public launch date for OCADE.
        </p>
        <p>
          Public legal, identity, verification, support and information pages can be available
          before the authenticated product opens. A public page does not promise that every OCADE
          feature, native app, browser extension, payment method, model, integration or platform
          build is already available. Release readiness remains a separate technical decision.
        </p>
      </PublicSection>

      <PublicSection title="3. Eligibility and users aged 16 or 17">
        <p>
          OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or
          personal-data features only where every consent, authorization or verified parental or
          lawful-guardian permission required by applicable law has been validly obtained and the
          relevant OCADE flow supports it.
        </p>
        <p>
          Where applicable law treats a person under 18 as a child for personal-data processing and
          OCADE does not yet provide the legally required verified-consent flow, that person must
          wait until legally eligible to use the affected account or personal-data feature. You must
          otherwise have legal capacity to agree to these Terms.
        </p>
      </PublicSection>

      <PublicSection title="4. OCADE service, Online and Offline">
        <p>
          OCADE offers connected Online intelligence and on-device Offline intelligence through one
          product experience. Online requests use OCADE's protected connected intelligence service.
          Offline requests are processed on the user's device and do not send the prompt to Online
          intelligence.
        </p>
        <p>
          Account authentication, saved conversations and files, current-information retrieval,
          support and other user-requested network services may process the minimum information
          reasonably necessary to provide those features. Feature availability can vary by device,
          browser, operating system, region, release stage and plan. Read the{" "}
          <Link to="/privacy" className="text-foreground underline">
            Privacy notice
          </Link>
          .
        </p>
      </PublicSection>

      <PublicSection title="5. Accounts, devices and security">
        <p>
          You are responsible for safeguarding your device, account, recovery methods and
          credentials used with third-party services. Never give OCADE Support your password,
          one-time code, PIN, recovery code, private key, full card number, CVV or other payment
          secret.
        </p>
        <p>
          You are responsible for activity performed through your account or device except to the
          extent applicable law provides otherwise. You must promptly report suspected unauthorized
          access through the available support or security channel.
        </p>
      </PublicSection>

      <PublicSection title="6. AI output can be inaccurate or wrong">
        <p>
          OCADE is an AI system. It can produce inaccurate, incomplete, outdated, misleading,
          duplicated, fabricated or otherwise incorrect output. It can misunderstand instructions,
          omit facts, cite an unsuitable source or reach an incorrect conclusion. You must
          independently verify important output before relying on it.
        </p>
        <p>
          OCADE is not a substitute for a qualified lawyer, doctor, accountant, tax professional,
          investment or financial adviser, cybersecurity professional, emergency service or other
          licensed professional. You remain responsible for decisions you make using OCADE.
        </p>
      </PublicSection>

      <PublicSection title="7. High-impact decisions and professional information">
        <p>
          Do not rely on OCADE alone for medical, legal, tax, accounting, investment, lending,
          insurance, employment, education, safety, cybersecurity, emergency, regulatory or other
          high-impact decisions. Where a decision can materially affect money, health, legal rights,
          safety or another person, obtain appropriate independent verification or professional
          advice.
        </p>
      </PublicSection>

      <PublicSection title="8. Computer control and authorized actions">
        <p>
          Permissioned computer-control features may open applications, read visible screens, type,
          click, navigate websites, create or edit files, move or delete files, interact with
          accounts and perform other actions that you authorize. AI can choose the wrong control,
          open the wrong app, modify or delete the wrong file, submit incorrect information, make a
          purchase attempt or send content to an unintended destination.
        </p>
        <p>
          You may use these features only on systems, accounts and content you are authorized to
          control. Important actions may require confirmation, but confirmation controls do not
          remove your responsibility to supervise the agent, review important work, maintain
          appropriate backups and stop the agent when an action is wrong or unexpected.
        </p>
      </PublicSection>

      <PublicSection title="9. Your content and commercial use of output">
        <p>
          You retain the rights you have in prompts, files and other content you provide. You grant
          CARCC only the permissions reasonably necessary to operate the features you choose,
          protect OCADE and comply with law. You remain responsible for having the rights and
          permissions needed for content, accounts and systems you provide or direct OCADE to use.
        </p>
        <p>
          Subject to applicable law, third-party rights and any separately disclosed licence, you
          may use OCADE-generated output for personal or commercial purposes, including posts,
          reels, videos, documents, presentations, software and business work. AI output is not
          guaranteed to be unique, copyrightable, accurate or free of third-party rights, and other
          users may receive similar output.
        </p>
      </PublicSection>

      <PublicSection title="10. CARCC and OCADE intellectual property">
        <p>
          CARCC and its applicable rights holders retain their rights in OCADE software, original
          code, interfaces, designs, systems, proprietary technology, brand materials, logos,
          product identity and the tagline “Command the Next Era.” Third-party and open-source
          software, model weights and other third-party materials remain governed by their own
          licences and rights.
        </p>
        <p>
          Using OCADE does not transfer ownership of the platform or CARCC brand to a user,
          contractor, service provider, investor or prospective investor.
        </p>
      </PublicSection>

      <PublicSection title="11. Acceptable use">
        <p>
          You may not use OCADE to violate law, infringe rights, access systems or accounts without
          authorization, distribute malware, commit fraud, facilitate theft, evade security or
          payment controls, attack OCADE or another service, intentionally harm people, impersonate
          others unlawfully or repeatedly violate these Terms.
        </p>
        <p>
          Restrictions on reverse engineering, interoperability or security testing apply only to
          the extent permitted by mandatory law and do not override rights granted by applicable
          open-source licences.
        </p>
      </PublicSection>

      <PublicSection title="12. Suspension, termination and feature changes">
        <p>
          CARCC may limit, suspend or terminate online access for illegal activity, hacking,
          malware, fraud, abuse, security-bypass attempts, attacks, non-payment, material or
          repeated Terms violations, security emergencies, misuse of third-party services or legal
          requirements. Notice may be provided where practicable or required.
        </p>
        <p>
          CARCC may modify, replace, restrict or discontinue a feature or service, including a free
          feature, subject to rights that applicable law does not permit these Terms to waive.
        </p>
      </PublicSection>

      <PublicSection title="13. Free launch and future paid services">
        <p>
          OCADE currently does not open paid checkout. Pricing may describe planned Free, Pro and
          Max options, but no paid charge is available until OCADE explicitly opens a purchase flow.
        </p>
        <p>
          If paid purchases are introduced later, the purchase flow must disclose the applicable
          price, taxes where required, duration or renewal rule, cancellation information and any
          purchase-specific conditions before a charge is made.
        </p>
      </PublicSection>

      <PublicSection title="14. Refund policy and payment errors">
        <p>
          Except where applicable law requires otherwise, a paid digital service is not eligible for
          a voluntary refund after the purchased service has been activated, accessed or used.
          Changing your mind after activation or use does not create a contractual right to a
          refund.
        </p>
        <p>
          A refund, reversal, credit or other remedy may still be required for a duplicate charge,
          billing or payment-processing error, non-delivery, unauthorized transaction where law
          provides protection, material service defect or deficiency, or another non-waivable
          consumer right. Nothing in these Terms removes a refund or remedy that applicable law
          requires CARCC or a payment provider to provide.
        </p>
      </PublicSection>

      <PublicSection title="15. Third-party services and external information">
        <p>
          OCADE may depend on authentication, hosting, network, cited websites, current-information
          retrieval and other external services needed for a feature you request. CARCC does not
          control those external services and cannot guarantee their availability, accuracy,
          security, content, pricing, policies or continued operation.
        </p>
        <p>
          Third-party outages, policy changes, data errors, rate limits, account restrictions,
          security incidents and service failures can affect OCADE.
        </p>
      </PublicSection>

      <PublicSection title="16. Service provided as available">
        <p>
          To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as
          available” basis. CARCC does not promise uninterrupted, error-free, loss-free, perfectly
          secure or perfectly accurate operation, or that every defect will be corrected.
        </p>
        <p>
          You should maintain independent records and backups for information that is important to
          you and use appropriate professional review for high-impact work.
        </p>
      </PublicSection>

      <PublicSection title="17. Limitation of liability and assumed risk">
        <p>
          To the maximum extent permitted by applicable law, CARCC, OCADE and their founder,
          personnel, contractors and service providers are not liable for indirect, incidental,
          special, exemplary, punitive or consequential loss; lost profits, revenue, business,
          opportunities or anticipated savings; investment or trading loss; data loss or corruption;
          business interruption; reputational harm; device, software or account problems; or losses
          caused by reliance on AI output, computer-control actions, third-party services, external
          information or incorrect professional decisions.
        </p>
        <p>
          This exclusion is intended to apply broadly, including to legal, medical, accounting, tax,
          investment, financial, cybersecurity and business decisions made using OCADE. Where a
          liability cannot lawfully be excluded, and except for liability that applicable law does
          not permit to be capped, any aggregate contractual liability arising from a paid OCADE
          service is limited to the amount actually paid by the claimant for the affected service in
          the three months immediately before the event giving rise to the claim.
        </p>
        <p>
          A free service does not create a promise to pay compensation merely because it was offered
          without charge. Nothing in this section excludes, limits or waives a statutory right,
          remedy or liability that applicable law does not permit a contract to exclude, limit or
          waive.
        </p>
      </PublicSection>

      <PublicSection title="18. Indemnity for unlawful or unauthorized use">
        <p>
          To the extent permitted by law, you agree to be responsible for third-party claims and
          reasonable losses caused by your unlawful use of OCADE, your intentional infringement of
          another person's rights, your fraud or your use of OCADE to access systems, accounts or
          content without authorization.
        </p>
        <p>
          This clause does not require a consumer to indemnify CARCC for CARCC's own liability where
          applicable law does not permit that result.
        </p>
      </PublicSection>

      <PublicSection title="19. No investment, shareholder or return promise">
        <p>
          Public references to investors, future ownership, equity or shareholding are invitations
          to begin a private discussion only. They are not an offer of securities, investment
          prospectus, solicitation to invest, crowdfunding offer, promise of allocation, valuation,
          dividend, liquidity event, return or future listing.
        </p>
        <p>
          Any future investment, ownership or shareholder arrangement requires separate diligence,
          legal advice, documentation, approvals, valuation discussions and compliance with the laws
          that apply to that transaction. No outside shareholder or investor is announced by these
          Terms.
        </p>
      </PublicSection>

      <PublicSection title="20. Governing law and dispute process">
        <p>
          These Terms are governed by the laws of India, without removing mandatory protections that
          may apply to a user in another jurisdiction. The parties should first try in good faith to
          resolve a dispute through the OCADE support process and direct negotiation.
        </p>
        <p>
          If an eligible dispute is not resolved informally, the parties may use mediation and,
          where the dispute is legally capable of arbitration, arbitration under the Arbitration and
          Conciliation Act, 1996, in English, by a mutually appointed sole arbitrator or another
          lawful appointment method. These Terms do not create an exclusive court-jurisdiction
          clause and do not block access to a consumer commission, regulator, non-arbitrable
          statutory forum, urgent interim relief or another forum that applicable law makes
          available and does not permit the parties to exclude.
        </p>
      </PublicSection>

      <PublicSection title="21. Communications and marketing">
        <p>
          OCADE may send essential authentication, account, security, service, transaction, support
          and legal communications. Marketing communications will be sent only where the required
          permission exists and will include an applicable way to opt out.
        </p>
      </PublicSection>

      <PublicSection title="22. Changes to these Terms">
        <p>
          CARCC may update these Terms as OCADE changes. Material changes will be identified through
          an appropriate notice before or when they take effect where required. If a change legally
          requires fresh consent, OCADE will request that consent rather than relying only on
          continued use.
        </p>
      </PublicSection>

      <PublicSection title="23. Current platform scope">
        <p>
          OCADE is currently offered as a website. A feature shown in source code, a demo, a test
          build, an old migration or a roadmap is not a promise that it is available in the current
          production website.
        </p>
      </PublicSection>

      <PublicSection title="24. General terms">
        <p>
          If part of these Terms is unenforceable, the remainder continues to the extent permitted
          by law. A delay in enforcing a term is not automatically a waiver. Provisions that by
          their nature should survive termination—including intellectual-property, payment,
          liability, investor and dispute provisions—continue to the extent legally applicable.
        </p>
      </PublicSection>

      <PublicSection title="25. Support, privacy, legal, security and investor enquiries">
        <p>
          OCADE does not publish unverified email addresses. Support, privacy, legal, security and
          investor enquiries are accepted only through channels OCADE has activated and verified.
        </p>
        <p>
          Visit the{" "}
          <Link to="/help" className="text-foreground underline">
            Help page
          </Link>{" "}
          for the current contact status. Dedicated support, privacy, legal, security and investor
          domain email channels may be published later only after they are activated and verified.
        </p>
      </PublicSection>

      <PublicSection title="26. Entire agreement and mandatory rights">
        <p>
          These Terms, the Privacy notice and any purchase-specific terms presented before a paid
          transaction form the applicable public contractual framework for OCADE unless another
          signed agreement applies. Nothing in these Terms is intended to remove consumer,
          data-protection or other statutory rights that cannot lawfully be waived.
        </p>
      </PublicSection>
    </>
  );
}

export function PrivacyContent() {
  return (
    <>
      <PublicSection title="1. Who is responsible">
        <p>
          CARCC is the independent technology enterprise, business brand and venture behind OCADE
          and is responsible for the OCADE service operations described in this notice. This notice
          uses the public CARCC brand identity and does not publish an unverified legal form,
          registration category, address or corporate status.
        </p>
      </PublicSection>

      <PublicSection title="2. Information OCADE may handle">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account identifiers and authentication events when you sign in.</li>
          <li>Basic profile, settings and device registrations.</li>
          <li>Conversations, messages and files under the storage mode you choose.</li>
          <li>
            Security, abuse-prevention and failure records designed to minimize raw user content.
          </li>
          <li>
            Payment status, provider references, invoice totals and receipt links if payments are
            enabled.
          </li>
          <li>
            Feature-specific information needed for a user-requested connector, retrieval or device
            action.
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="3. Google Sign-In and authentication">
        <p>
          If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and
          basic account information such as your name, email address and profile image according to
          the permissions shown during sign-in. OCADE uses that information to authenticate the
          account, maintain the session, protect the service and provide account features.
        </p>
        <p>
          Google account information is not sold or used by OCADE for targeted advertising and is
          not used to train a public AI model.
        </p>
      </PublicSection>

      <PublicSection title="4. Online and Offline processing">
        <p>
          When you choose Offline, supported AI inference is performed on your device. Saved
          conversations, account settings and files may still synchronize with your OCADE account
          when a connection is available unless you use a feature such as Temporary Chat that is
          specifically described as not being saved.
        </p>
        <p>
          When you choose Online, your request is processed through OCADE's protected connected
          intelligence service. OCADE keeps underlying model/provider implementation details out of
          the normal product interface, but Online processing necessarily uses network services.
        </p>
      </PublicSection>

      <PublicSection title="5. Purposes of processing">
        <p>
          Information may be used to provide requested features, authenticate and secure accounts,
          store your workspace data so it is available on the devices you sign in on, maintain
          reliability, prevent abuse, investigate security events, process support or rights
          requests, maintain payment records when payments are enabled and comply with applicable
          law.
        </p>
      </PublicSection>

      <PublicSection title="6. Service providers and sharing">
        <p>
          Depending on the feature, recipients may include authentication, hosting, network,
          current-information and other processors or services necessary to deliver the feature you
          request. If you explicitly choose Google Sign-In, Google also processes that sign-in under
          the permissions shown to you.
        </p>
        <p>
          OCADE does not sell personal information to advertisers. Information is not shared merely
          because a third party wants to advertise to you.
        </p>
      </PublicSection>

      <PublicSection title="7. Where your workspace data is stored">
        <p>
          Saved conversations, messages, Library files, account settings and enabled account memory
          are stored through OCADE's protected account infrastructure so that they can be available
          on devices where you sign in. Temporary Chat is not saved.
        </p>
        <p>
          Two categories remain on the device. Offline Intelligence model data is stored on the
          machine it was installed on and is not workspace content; it persists until you remove it,
          including after signing out or deleting your account. Device preferences — such as theme,
          language, interface layout and an unsent message draft — are stored in that browser
          because they describe that device rather than you.
        </p>
        <p>
          OCADE may keep the minimum local pending information needed to finish synchronizing saved
          work after a connection returns. Temporary Chat remains outside that synchronization flow.
        </p>
      </PublicSection>

      <PublicSection title="8. Current-information retrieval and connectors">
        <p>
          A current-information request, connector or user-authorized external service can send the
          minimum information reasonably needed to perform the requested action. External sources
          and services may have their own privacy notices and retention rules.
        </p>
      </PublicSection>

      <PublicSection
        id="jarvis"
        title="9. OCADE JARVIS, the Device Agent and the OCADE app on phones"
      >
        <p>
          When you ask OCADE JARVIS to do something on a computer or phone you connected, the OCADE
          Device Agent or the OCADE app sends your OCADE account what it needs for that task: the
          text and structure of the page, window or screen it is working in, its address and title,
          screenshots for the live view, and the result of each step. It does this only while a task
          you started is running, only in the tabs, apps and workspace folder JARVIS was given, and
          only to OCADE.
        </p>
        <p>
          In your own browser, JARVIS works only in tabs it opened; it never reads other tabs, saved
          passwords or payment details, and hands CAPTCHA, one-time codes and passkeys to you. Page
          content is used to carry out your task, is not sold, is not used for advertising and is
          not used to train models. Detailed task activity is kept for 90 days; screenshots are kept
          only while a task runs. Remove a computer or phone in JARVIS Devices at any time; its key
          stops working at once, and you can delete JARVIS conversations and activity from your
          account.
        </p>
      </PublicSection>

      <PublicSection title="10. Support requests and sensitive secrets">
        <p>
          A support request may contain the information you choose to provide. Never include
          passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or
          other authentication or payment secrets.
        </p>
      </PublicSection>

      <PublicSection title="11. Retention, deletion and backups">
        <p>
          Device-only data remains subject to your device controls. Cloud records are intended to be
          retained only while reasonably necessary for the account, requested service, security,
          legal obligation, payment record or dispute. Backup deletion may take additional time and
          some records may need to be retained where law requires.
        </p>
      </PublicSection>

      <PublicSection title="12. Your privacy choices and rights">
        <p>
          Depending on applicable law, you may have rights to access, correct or erase personal
          information, withdraw consent, object to certain processing or raise a grievance. Use the
          data-rights controls in Settings (export and deletion), or a verified privacy channel
          listed on the Help page.
        </p>
      </PublicSection>

      <PublicSection title="13. Users aged 16 or 17">
        <p>
          OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where
          applicable law treats a 16- or 17-year-old as a child for personal-data processing, the
          required verified parent or lawful-guardian consent must be obtained before the relevant
          processing unless a lawful exemption applies.
        </p>
        <p>
          If OCADE does not yet provide the legally required consent flow, that user must wait until
          legally eligible to use the affected account or personal-data feature.
        </p>
      </PublicSection>

      <PublicSection title="14. Security">
        <p>
          OCADE uses measures including access controls, row-level security, restricted storage
          patterns and security checks appropriate to the relevant feature. No device, network or
          online service can guarantee absolute security.
        </p>
      </PublicSection>

      <PublicSection title="15. Changes and contact">
        <p>
          CARCC may update this notice as OCADE changes. Material privacy changes will be identified
          through an appropriate notice and fresh consent will be requested where the law requires
          it.
        </p>
        <p>
          Until dedicated privacy, security and grievance channels are activated, the requests you
          can make yourself — a copy of your data, deletion of your data or account, and signing
          out every session — are in Settings. Dedicated email addresses will be published only
          after they are activated and verified. Visit the{" "}
          <Link to="/help" className="text-foreground underline">
            Help page
          </Link>{" "}
          for current contact status.
        </p>
      </PublicSection>
    </>
  );
}
