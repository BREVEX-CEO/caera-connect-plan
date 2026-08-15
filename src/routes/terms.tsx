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
      eyebrow="Last updated 15 August 2026"
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
          Demo mode uses sample data and is not a production account. Current source models 28
          successful cloud requests in each eight-hour window while local processing remains
          unlimited where available. It does not implement “28 hours of use followed by an 8-hour
          lockout.” Prices, taxes, renewal, refunds, cancellation and provider-specific payment
          terms must be shown at checkout and approved before payments are accepted.
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
