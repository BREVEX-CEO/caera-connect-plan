import { Link } from "@tanstack/react-router";
import { PublicSection } from "@/components/public/PublicPage";

export const TERMS_META = {
  eyebrow: "Effective and last updated 25 August 2026",
  title: "Terms of service",
  summary:
    "These Terms apply now to the OCADE public website and to OCADE services as they become available. CARCC CADANE records 28 August 2026 as the scheduled founding and public-launch date for OCADE.",
};

export const PRIVACY_META = {
  eyebrow: "Effective and last updated 25 August 2026",
  title: "Privacy notice",
  summary:
    "This notice explains how CARCC CADANE intends to handle information for the OCADE website, authentication, local-first AI, Private Sync, support and other user-requested services.",
};

export function TermsContent() {
  return (
    <>
      <PublicSection title="1. Agreement and service provider">
        <p>
          These Terms form the rules for using the OCADE website and OCADE services made available
          by CARCC CADANE. CARCC CADANE is the independent technology enterprise, business brand and
          venture behind OCADE. HAANS ANTONI is its Founder, CEO and Chairman and the creator of
          OCADE. Nothing in these Terms describes CARCC CADANE as a Private Limited Company, LLP or
          other legal form that has not been separately established and verified.
        </p>
        <p>
          The public website may be available before the authenticated product. CARCC CADANE records
          28 August 2026 as the scheduled founding and public-launch date. Availability of a public
          information page does not mean every OCADE feature, native application, store release,
          payment method or integration is already available.
        </p>
      </PublicSection>

      <PublicSection title="2. Eligibility and younger users">
        <p>
          OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or
          personal-data features only where the consent or authorization required by applicable law
          has been validly obtained and the relevant OCADE flow supports it. Where applicable law
          requires a parent or lawful guardian to consent and that verified consent flow is not yet
          available, the user must wait until legally eligible to use that feature.
        </p>
        <p>
          You must have legal capacity to agree to these Terms and must provide accurate information
          where the service reasonably requires it.
        </p>
      </PublicSection>

      <PublicSection title="3. OCADE service and local-first architecture">
        <p>
          OCADE combines local software with optional online authentication, Private Sync,
          current-information retrieval, support, payments and permissioned remote-device features.
          Supported chat generation is designed to run on the user's device rather than through a
          public-cloud AI inference provider. Feature availability may vary by device, hardware,
          browser, operating system, region, release stage and plan.
        </p>
        <p>
          Optional Google authentication, Supabase, Cloudflare, Private Sync, current-information
          retrieval and other user-requested network services may process the information necessary
          to provide those features. Read the <Link to="/privacy" className="text-foreground underline">Privacy notice</Link> for details.
        </p>
      </PublicSection>

      <PublicSection title="4. Accounts, devices and security">
        <p>
          You are responsible for safeguarding your device, account, recovery methods and any
          credentials used with third-party services. Never give OCADE Support your password,
          one-time code, PIN, recovery code, private key or full payment credential. You are
          responsible for activity performed through your account except to the extent applicable
          law provides otherwise.
        </p>
      </PublicSection>

      <PublicSection title="5. AI output can be wrong">
        <p>
          OCADE is an AI system and may produce inaccurate, incomplete, outdated, misleading,
          duplicated or otherwise incorrect output. You must independently verify important output
          before relying on it. OCADE is not a substitute for a qualified lawyer, doctor,
          accountant, tax professional, investment or financial adviser, cybersecurity professional
          or emergency service.
        </p>
        <p>
          You remain responsible for decisions you make using OCADE. Do not rely on OCADE alone for
          high-impact medical, legal, tax, accounting, financial, investment, safety, employment,
          security or emergency decisions.
        </p>
      </PublicSection>

      <PublicSection title="6. Computer control and authorized actions">
        <p>
          Permissioned computer-control features may open applications, read visible screens, type,
          click, create, edit, move or delete files, navigate websites and perform other actions that
          you authorize. AI can select the wrong control, open the wrong application, alter or delete
          the wrong file, submit incorrect information or send content to an unintended destination.
        </p>
        <p>
          You may use computer control only on systems, accounts and content you are authorized to
          control. Important actions may require confirmation, but confirmation controls do not
          remove your duty to supervise the agent, review important work, maintain backups where
          appropriate and stop the agent when an action is wrong or unexpected.
        </p>
      </PublicSection>

      <PublicSection title="7. Your content and AI output">
        <p>
          You retain the rights you have in prompts, files and other content you provide. You grant
          CARCC CADANE only the permissions reasonably necessary to operate the features you choose,
          protect OCADE and comply with law. You are responsible for having the rights and
          permissions needed for content, accounts and systems you provide or direct OCADE to use.
        </p>
        <p>
          Subject to applicable law, third-party rights and any separately disclosed licence, you
          may use OCADE-generated output for personal or commercial purposes, including posts,
          videos, reels, documents and business work. AI output is not guaranteed to be unique and
          other users may receive similar output. You are responsible for checking whether your use
          infringes third-party rights or requires additional permission.
        </p>
      </PublicSection>

      <PublicSection title="8. CARCC CADANE and OCADE intellectual property">
        <p>
          CARCC CADANE and its rights holders retain their rights in OCADE software, original code,
          interfaces, designs, systems, proprietary technology, brand materials, logos and the
          tagline “Command the Next Era.” Third-party and open-source software, model weights and
          other third-party materials remain governed by their own licences and rights. Use of OCADE
          does not transfer ownership of the OCADE platform or CARCC CADANE brand to a user,
          contractor, investor or service provider.
        </p>
      </PublicSection>

      <PublicSection title="9. Acceptable use">
        <p>
          You may not use OCADE to violate law, infringe rights, access systems or accounts without
          authorization, distribute malware, commit fraud, evade security or payment controls,
          attack OCADE or another service, intentionally harm people, or repeatedly violate these
          Terms. Restrictions on reverse engineering or interoperability apply only to the extent
          permitted by mandatory law and do not override third-party open-source licences.
        </p>
      </PublicSection>

      <PublicSection title="10. Suspension, termination and feature changes">
        <p>
          CARCC CADANE may limit, suspend or terminate online access for illegal activity, hacking,
          malware, fraud, abuse, security bypass attempts, attacks, non-payment, material or repeated
          Terms violations, security emergencies or legal requirements. Notice may be provided where
          practicable and required. CARCC CADANE may also modify, discontinue or replace a feature
          or service, subject to any rights that applicable law does not permit these Terms to waive.
        </p>
      </PublicSection>

      <PublicSection title="11. Free launch, future paid services and checkout terms">
        <p>
          OCADE may initially be offered without charge while product and payment work is completed.
          Free availability can change. Paid plans, subscriptions, fixed-duration access or other
          commercial services may be introduced later. Before a paid purchase, the checkout must
          display the applicable price, taxes where required, duration or renewal rule, cancellation
          information and any purchase-specific conditions.
        </p>
        <p>
          Payment providers and app stores may impose their own terms. OCADE is designed to store
          payment status, provider references, invoice totals and receipt links rather than full card
          details, UPI PINs or similar payment secrets.
        </p>
      </PublicSection>

      <PublicSection title="12. Refunds and payment errors">
        <p>
          Except where applicable law requires otherwise, a paid digital service is not eligible for
          a voluntary refund after the purchased service has been activated or used. A refund,
          reversal, credit or other remedy may still be required or appropriate for a duplicate
          charge, billing or payment-processing error, non-delivery, a material service defect or
          deficiency, an unauthorized transaction where law provides protection, or another
          non-waivable consumer right.
        </p>
        <p>
          Nothing in these Terms promises a refund merely because a user changes their mind after
          using a paid service, and nothing in these Terms removes a remedy that applicable law
          requires CARCC CADANE or a payment provider to provide.
        </p>
      </PublicSection>

      <PublicSection title="13. Third-party services">
        <p>
          OCADE may depend on services supplied by Google, Supabase, Cloudflare, app stores, payment
          providers, cited websites, network operators and other third parties. CARCC CADANE does
          not control those services and cannot guarantee their availability, accuracy, security or
          continued operation. Third-party outages, policy changes and service failures can affect
          OCADE.
        </p>
      </PublicSection>

      <PublicSection title="14. Service provided as available">
        <p>
          To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as
          available” basis. CARCC CADANE does not promise uninterrupted, error-free, loss-free or
          perfectly accurate operation, or that every defect will be corrected. You should maintain
          appropriate independent records and backups for information that is important to you.
        </p>
      </PublicSection>

      <PublicSection title="15. Limitation of liability and assumed risks">
        <p>
          To the maximum extent permitted by applicable law, CARCC CADANE, OCADE and their founder,
          personnel and service providers are not liable for indirect, incidental, special,
          exemplary, punitive or consequential loss, or for lost profits, lost revenue, lost
          business, lost opportunities, investment loss, data loss or corruption, business
          interruption, reputational harm, device or software problems, or losses caused by relying
          on AI output, computer-control actions, third-party services, or incorrect legal, medical,
          tax, accounting, financial, investment, cybersecurity or other professional decisions.
        </p>
        <p>
          Where liability cannot lawfully be excluded, and except for liability that applicable law
          does not permit to be capped, the aggregate liability arising from a paid OCADE service is
          limited to the amount actually paid by the claimant for the affected OCADE service during
          the three months immediately before the event giving rise to the claim. A free service
          does not create a promise to pay compensation merely because it was free. Mandatory
          statutory rights and liabilities remain unaffected.
        </p>
      </PublicSection>

      <PublicSection title="16. Indemnity for unlawful or unauthorized use">
        <p>
          To the extent permitted by law, you agree to be responsible for third-party claims and
          reasonable losses caused by your unlawful use of OCADE, your intentional infringement of
          another person's rights, or your use of OCADE to access systems, accounts or content
          without authorization. This clause does not require a consumer to indemnify CARCC CADANE
          for CARCC CADANE's own liability where the law does not permit that result.
        </p>
      </PublicSection>

      <PublicSection title="17. Governing law and dispute process">
        <p>
          These Terms are governed by the laws of India, without removing mandatory protections that
          may apply to a user in another jurisdiction. Before starting a formal dispute, the parties
          should first try in good faith to resolve it through the OCADE support process.
        </p>
        <p>
          Where a dispute is legally capable of arbitration and the parties do not resolve it
          informally, it may be referred to arbitration under the Arbitration and Conciliation Act,
          1996, in English, by a mutually appointed sole arbitrator or by an appointment method
          permitted by law. This clause does not prevent access to a consumer commission,
          statutory regulator, non-arbitrable forum, court for urgent interim relief, or another
          forum where applicable law gives a right that cannot validly be excluded.
        </p>
      </PublicSection>

      <PublicSection title="18. Communications and marketing">
        <p>
          OCADE may send essential account, authentication, security, legal and service messages.
          Marketing communications will be sent only where the required permission exists and will
          include the applicable way to opt out.
        </p>
      </PublicSection>

      <PublicSection title="19. Changes to these Terms">
        <p>
          CARCC CADANE may update these Terms as OCADE changes. Material changes will be identified
          through an appropriate notice before or when they take effect where required. If a change
          legally requires fresh consent, OCADE will request that consent rather than relying only on
          continued use.
        </p>
      </PublicSection>

      <PublicSection title="20. General terms">
        <p>
          If part of these Terms is unenforceable, the remainder continues to the extent permitted
          by law. A delay in enforcing a term is not automatically a waiver. Provisions that by their
          nature should survive termination—including intellectual-property, payment, liability and
          dispute provisions—continue to the extent legally applicable.
        </p>
      </PublicSection>

      <PublicSection title="21. Support, legal, privacy and investor enquiries">
        <p>
          OCADE uses a ticket-based support system rather than publishing an unverified email
          address. Signed-in requests are stored in the OCADE support queue and can be reviewed in
          the administrative support workspace. Support categories include account, billing,
          technical, privacy, security, feedback, legal, investor and partnership enquiries.
          Dedicated domain email channels will be published only after they are activated and
          verified.
        </p>
        <p>
          Visit the <Link to="/support" className="text-foreground underline">Support page</Link> for the current contact status. Investor and strategic-partnership enquiries are discussions only;
          nothing on the OCADE website is an offer to sell securities, a solicitation to invest or a
          promise that equity or shareholding will be offered.
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
          CARCC CADANE is the independent technology enterprise, business brand and venture behind
          OCADE and is responsible for the OCADE service operations described in this notice. This
          public notice does not claim a legal form, registration category, address or corporate
          status that has not separately been published and verified.
        </p>
      </PublicSection>

      <PublicSection title="2. Information OCADE may handle">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account identifiers and authentication events when you sign in.</li>
          <li>Basic profile, settings and device registrations.</li>
          <li>Conversations, messages and files under the storage mode you choose.</li>
          <li>Support tickets, support messages and information you choose to include in them.</li>
          <li>Security, abuse-prevention and failure records designed to minimize raw user content.</li>
          <li>Payment status, provider references, invoice totals and receipt links if payments are enabled.</li>
        </ul>
      </PublicSection>

      <PublicSection title="3. Google Sign-In and authentication">
        <p>
          If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and
          basic account information such as your name, email address and profile image according to
          the permissions shown during sign-in. OCADE uses that information to authenticate the
          account, maintain the session, protect the service and provide account features. Google
          account information is not sold or used for targeted advertising by OCADE.
        </p>
      </PublicSection>

      <PublicSection title="4. Local-first does not mean local-only">
        <p>
          Supported AI generation is designed to run locally on your device. Device-only processing
          keeps supported data under your device controls. Optional Google authentication, Private
          Sync, Supabase, Cloudflare, current-information retrieval, payments, mobile pairing,
          support and other user-requested network services may process the minimum information
          reasonably necessary to provide those features. OCADE does not silently send normal chat
          generation to a public-cloud AI inference provider.
        </p>
      </PublicSection>

      <PublicSection title="5. Why information is used">
        <p>
          Information may be used to provide features you request, authenticate and secure accounts,
          synchronize data when you choose Private Sync, maintain reliability, prevent abuse,
          enforce entitlements, process support or rights requests, maintain payment records when
          payments are enabled, and comply with applicable law.
        </p>
      </PublicSection>

      <PublicSection title="6. Sharing and service providers">
        <p>
          Depending on the feature you choose, recipients may include Supabase, Cloudflare, Google
          or another authentication provider, cited source websites, app stores, payment providers
          and other service providers necessary to deliver that feature. OCADE does not sell
          personal information to advertisers. Providers may process information in different
          countries subject to their service arrangements and applicable legal safeguards.
        </p>
      </PublicSection>

      <PublicSection title="7. Retention and deletion">
        <p>
          Device-only data remains controlled through your device and OCADE's local controls. Cloud
          records are intended to be retained only while reasonably necessary for the relevant
          account, requested service, security, legal obligation or dispute. Backup deletion may take
          additional time. Payment or security records may need to be retained where law requires.
        </p>
      </PublicSection>

      <PublicSection title="8. Your choices and rights">
        <p>
          Depending on applicable law, you may have rights to access, correct or erase personal
          information, withdraw consent, object to certain processing or raise a grievance. OCADE
          will verify requests without intentionally collecting more identity information than
          reasonably necessary. Use the <Link to="/data-rights" className="text-foreground underline">data-rights route</Link> where available or create a privacy ticket through OCADE Support.
        </p>
      </PublicSection>

      <PublicSection title="9. Users aged 16 or 17">
        <p>
          OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where
          applicable law treats a 16- or 17-year-old as a child for personal-data processing, the
          required verified parent or lawful-guardian consent must be obtained before the relevant
          processing unless a lawful exemption applies. If OCADE does not yet provide the legally
          required consent flow, that user must wait until legally eligible to use the affected
          account or personal-data feature.
        </p>
      </PublicSection>

      <PublicSection title="10. Cookies, local storage and analytics">
        <p>
          OCADE may use local storage or similar technology necessary for authentication,
          preferences, security and offline operation. Non-essential analytics or marketing
          technology must not be enabled where consent is required until the applicable choice is
          available. Cloudflare may provide website and edge infrastructure, including operational
          security and performance signals according to the deployed configuration.
        </p>
      </PublicSection>

      <PublicSection title="11. Security">
        <p>
          OCADE uses measures including access controls, row-level security and restricted storage
          patterns, but no device, network or online service can guarantee absolute security. Do not
          put passwords, one-time codes, PINs, recovery codes, private keys or full payment
          credentials into support tickets.
        </p>
      </PublicSection>

      <PublicSection title="12. Contact and complaints">
        <p>
          Privacy, security and grievance requests use the OCADE ticket system while dedicated
          domain email channels are being established. Signed-in tickets are kept in the OCADE
          support queue for review in the administrative support workspace. Visit the <Link to="/support" className="text-foreground underline">Support page</Link> for current contact options. Dedicated email addresses will be published only after they are activated and verified.
        </p>
      </PublicSection>

      <PublicSection title="13. Changes to this notice">
        <p>
          CARCC CADANE may update this notice when OCADE features, providers or legal requirements
          change. Material changes will be identified through an appropriate notice where required,
          and fresh consent will be requested where applicable law requires it.
        </p>
      </PublicSection>
    </>
  );
}
