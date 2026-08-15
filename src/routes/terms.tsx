import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftNotice, PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — OCADE" },
      { name: "description", content: "Pre-launch terms of service for OCADE." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicPage
      eyebrow="Last updated 16 August 2026"
      title="Terms of service"
      summary="These draft terms describe the intended service rules. They are not effective until legal review, publication and acceptance through the launched service."
    >
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
          OCADE combines local software with optional online account, synchronization, cloud,
          payment and remote-device features. Feature availability varies by platform, hardware,
          region and plan. Pre-release source, demos and test evidence are not promises that a
          production feature is available.
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
          Demo mode uses sample data and is not a production account. Paid plans are 8 days for
          ₹288 or 4.28 in the selected supported international currency, 30 days for ₹488 or 28,
          and 1 year for ₹5,888 or 128. The 8-day, 30-day and annual plans include 28, 56 and 128
          successful OCADE Cloud requests respectively in each eight-hour window. Supported local
          processing remains unlimited. Taxes and currency conversion, where required, must be
          shown before payment.
        </p>
        <p>
          These are fixed-duration purchases and do not renew automatically unless a future
          checkout clearly offers renewal and the user separately opts in. Final refund,
          cancellation and statutory consumer-right wording requires legal review before payments
          are accepted.
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
          notice where practicable. Subscription expiry may end cloud and premium access but should
          not block supported local inference, local data access or local export. Final deletion and
          appeal procedures must be approved before launch.
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
    </PublicPage>
  );
}
