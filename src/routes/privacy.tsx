import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftNotice, PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — OCADE" },
      {
        name: "description",
        content: "Pre-launch privacy notice for OCADE by CAERA CADANE.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Last updated 15 August 2026"
      title="Privacy notice"
      summary="This notice explains the intended data handling for OCADE. It will take effect only after legal review, contact-channel activation and publication with the launched service."
    >
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
          <li>Profile, settings, device registrations, subscription and allowance records.</li>
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
          selected account data in the configured Supabase service. Cloud-assisted AI, web access,
          mobile pairing and payments can send the minimum necessary data to the disclosed service
          after the applicable choice or request. OCADE must not silently move device-only content
          to cloud storage.
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
          Depending on the feature, recipients may include Supabase, Cloudflare, selected model or
          search providers, authentication providers, app stores and payment providers. The final
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
    </PublicPage>
  );
}
