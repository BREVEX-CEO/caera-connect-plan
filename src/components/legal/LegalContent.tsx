/**
 * The legal text, written once and rendered in two places.
 *
 * Terms and Privacy used to live only inside their route components, so the
 * signup form could only reach them with a `<Link>` — a navigation that threw
 * away whatever the person had typed into the form. Reading the terms should
 * not cost you your email address and password.
 *
 * Extracting the bodies means the in-site dialog and the standalone page show
 * the SAME words, which also removes the failure where one gets updated and
 * the other quietly does not.
 */
import { Link } from "@tanstack/react-router";
import { DraftNotice, PublicSection } from "@/components/public/PublicPage";

export const TERMS_META = {
  eyebrow: "Last updated 16 August 2026",
  title: "Terms of service",
  summary:
    "These draft terms describe the intended service rules. They are not effective until legal review, publication and acceptance through the launched service.",
};

export const PRIVACY_META = {
  eyebrow: "Last updated 15 August 2026",
  title: "Privacy notice",
  summary:
    "This notice explains the intended data handling for OCADE. It will take effect only after legal review, contact-channel activation and publication with the launched service.",
};

export function TermsContent() {
  return (
    <>
      <DraftNotice />
      <PublicSection title="Provider and eligibility">
        <p>
          The final terms must identify the incorporated provider or, if still lawful and intended,
          Haans Antoni operating the CAERA CADANE brand. Users must have legal capacity to contract.
          Age and parental-consent requirements must be finalized before launch.
        </p>
      </PublicSection>
      <PublicSection title="OCADE service">
        <p>
          OCADE combines local software with optional online account, private synchronization,
          current-information retrieval, payment and remote-device features. Chat generation stays
          on the user's device. Feature availability varies by platform, hardware, region and plan.
          Pre-release source, demos and test evidence are not promises that a production feature is
          available.
        </p>
      </PublicSection>
      <PublicSection title="Accounts, security and devices">
        <p>
          You are responsible for protecting your account and devices and for keeping recovery
          information current. The planned subscription entitlement permits up to two mobile and two
          desktop devices. Device replacement, household use, business seats and abuse limits must
          be stated in the final commercial schedule.
        </p>
      </PublicSection>
      <PublicSection title="Demo, subscriptions and limits">
        <p>
          OCADE is free during launch and nothing can be purchased today. Demo mode uses sample data
          and is not a production account. Plan prices shown elsewhere in the product are for
          reference only. Earlier drafts of these terms described an allowance of OCADE Cloud
          requests; there is no cloud inference service, no request is metered, and processing on
          your own device is unlimited. If paid plans are introduced, taxes and currency conversion,
          where required, must be shown before payment.
        </p>
        <p>
          These are fixed-duration purchases and do not renew automatically unless a future checkout
          clearly offers renewal and the user separately opts in. Final refund, cancellation and
          statutory consumer-right wording requires legal review before payments are accepted.
        </p>
      </PublicSection>
      <PublicSection title="Payment methods, invoices and support">
        <p>
          Planned web payment methods are Razorpay-hosted UPI Intent or QR and cards, plus PayPal
          for eligible international transactions. Availability depends on approved provider
          accounts and location. OCADE stores provider references, status, invoice totals and
          receipt links—not full card details, UPI PINs or PayPal credentials. Signed-in customers
          can view their payment and invoice history and keep the full history of support cases.
        </p>
      </PublicSection>
      <PublicSection title="App-store purchases">
        <p>
          Purchases in mobile apps may be processed and governed by Apple or Google billing rules.
          Web, India and international payment methods may differ. OCADE will not direct users
          around mandatory store billing rules or claim an unavailable payment method.
        </p>
      </PublicSection>
      <PublicSection title="Your data and content">
        <p>
          You retain rights in content you submit. You grant only the permissions needed to provide
          the selected features, secure the service and meet legal obligations. Read the{` `}
          <Link to="/privacy" className="text-foreground underline">
            privacy notice
          </Link>
          . You remain responsible for having permission to use content, accounts and systems that
          OCADE accesses at your direction.
        </p>
      </PublicSection>
      <PublicSection title="CAERA CADANE and OCADE intellectual property">
        <p>
          CAERA CADANE, OCADE, the tagline “Command the Next Era,” their logos, official
          pronunciations, and the original brand definitions published on the official company and
          product pages are proprietary brand materials claimed by Haans Antoni before formal
          company assignment. After a valid written assignment, the identified incorporated entity
          may become the owner. No term here claims ownership of third-party open-source software,
          model weights, ordinary dictionary words, or rights that applicable law does not permit.
          Users receive only the limited licence stated in the final commercial terms; no ownership
          is transferred to a user, shareholder, contractor or service provider merely through use
          of OCADE.
        </p>
      </PublicSection>
      <PublicSection title="AI and computer-control safety">
        <p>
          AI output may be inaccurate or incomplete and must be checked before reliance. Computer
          control can open apps, type, read screens and act on files or accounts. Users must
          supervise important actions, respect confirmation prompts and stop the agent when an
          action is wrong. OCADE is not a substitute for professional medical, legal or financial
          advice.
        </p>
      </PublicSection>
      <PublicSection title="Acceptable use">
        <p>
          You may not use OCADE to break law, infringe rights, access systems without permission,
          distribute malware, evade security or payment controls, or harm people. Reverse
          engineering and interoperability restrictions apply only to the extent permitted by
          mandatory law and do not override third-party open-source licences.
        </p>
      </PublicSection>
      <PublicSection title="Suspension, termination and local access">
        <p>
          Online services may be limited for security, abuse, non-payment or legal reasons with fair
          notice where practicable. Subscription expiry must not block supported local inference,
          local data access or local export. Final deletion and appeal procedures must be approved
          before launch.
        </p>
      </PublicSection>
      <PublicSection title="Warranties, liability, law and disputes">
        <p>
          Consumer rights that cannot be waived remain intact. Any warranty disclaimer, liability
          cap, governing-law clause, dispute process and Bengaluru jurisdiction clause must be
          reviewed for Indian consumer, contract and global-market law before these terms become
          effective.
        </p>
      </PublicSection>
    </>
  );
}

export function PrivacyContent() {
  return (
    <>
      <DraftNotice />
      <PublicSection title="Who is responsible">
        <p>
          Before incorporation and formal assignment, Haans Antoni operates the CAERA CADANE brand
          and is the proposed data fiduciary for OCADE. The final notice must replace this statement
          with the verified legal entity name, registered address, grievance contact and privacy
          contact before launch.
        </p>
      </PublicSection>
      <PublicSection title="Data OCADE may handle">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account identifiers and authentication events when you sign in.</li>
          <li>Profile, settings, device registrations and subscription records.</li>
          <li>Conversations, messages and files only under the storage mode you choose.</li>
          <li>
            Security, abuse-prevention and failure records designed to avoid raw user content.
          </li>
          <li>
            Payment status and provider references; full card or UPI credentials should stay with
            the payment provider.
          </li>
        </ul>
      </PublicSection>
      <PublicSection title="Local-first does not mean local-only">
        <p>
          Device-only or local processing keeps supported data on your device. Private Sync stores
          selected account data in the configured Supabase service. Current-information requests,
          mobile pairing and payments can send the minimum necessary data to the disclosed service
          after the applicable choice or request. Chat generation is not sent to a public-cloud AI
          provider. OCADE must not silently move device-only content to remote storage.
        </p>
      </PublicSection>
      <PublicSection title="Purposes and legal basis">
        <p>
          Data is intended to be used to provide the service you request, secure accounts and
          devices, enforce entitlements, maintain reliability, comply with law and respond to your
          support or rights request. The final notice must map each purpose to a valid consent,
          contract or statutory basis for every launch country.
        </p>
      </PublicSection>
      <PublicSection title="Sharing and international processing">
        <p>
          Depending on the feature, recipients may include Supabase, Cloudflare, cited search or
          source sites, authentication providers, app stores and payment providers. The final
          provider list, locations, retention terms and cross-border safeguards must be verified
          before those features are enabled.
        </p>
      </PublicSection>
      <PublicSection title="Retention and deletion">
        <p>
          Device-only data remains under your device controls. Cloud records should be retained only
          while necessary for the stated purpose, legal obligations, security and dispute handling.
          Exact retention periods and backup-deletion windows are not yet approved and must be added
          before launch. Expiry of a subscription must not lock you out of exportable local data.
        </p>
      </PublicSection>
      <PublicSection title="Your choices and rights">
        <p>
          Depending on applicable law, you may request access, correction, erasure, withdrawal of
          consent or grievance handling. OCADE must verify a requester without collecting more
          identity data than necessary. Use the{` `}
          <Link to="/data-rights" className="text-foreground underline">
            data-rights request builder
          </Link>
          ; its transmission channel is not active yet.
        </p>
      </PublicSection>
      <PublicSection title="Cookies and similar storage">
        <p>
          The audited source does not include advertising or third-party analytics trackers. Local
          storage needed for authentication, preferences, security and offline operation is treated
          as essential. Any future non-essential analytics or marketing technology must remain off
          until the user makes the legally required choice; the notice and consent controls must be
          updated before deployment.
        </p>
      </PublicSection>
      <PublicSection title="Children, security and complaints">
        <p>
          Age eligibility and parental-consent handling are not yet finalized; the service must not
          be marketed to children until that policy and its controls are approved. OCADE uses access
          controls, row-level security and restricted storage patterns, but no service can promise
          absolute security. The final notice must publish a working grievance and privacy contact.
        </p>
      </PublicSection>
    </>
  );
}
