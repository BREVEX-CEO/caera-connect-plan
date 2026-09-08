import { createFileRoute, Link } from "@tanstack/react-router";
import { Notice, PublicPage, PublicSection } from "@/components/public/PublicPage";
import { SECURITY_DISCLOSURE, SECURITY_POSTURE } from "@/lib/security/public-posture";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — OCADE by CARCC CADANE" },
      {
        name: "description",
        content:
          "How OCADE protects data in transit and at rest, what stays on your device, how access is controlled, and how to report a vulnerability.",
      },
      { property: "og:title", content: "Security — OCADE" },
      {
        property: "og:description",
        content: "OCADE's security architecture, stated only where it is implemented.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SecurityPage,
});

/**
 * OCADE'S PUBLIC SECURITY SURFACE.
 *
 * PLAN.md §J asks for this page and then spends a paragraph on what it must
 * never say: no SOC 2, no ISO, no "GDPR certified", no HIPAA compliance, no
 * penetration test, no zero-incident claim, no badges — none of it without
 * evidence. A security page is read by somebody deciding whether to trust a
 * product with their work, which makes an unearned claim here worse than no
 * page at all.
 *
 * So every statement below names the thing that implements it, and each one was
 * read in the source before it was written down. `public-posture.ts` holds the
 * claims and their implementing modules together, and a test asserts each named
 * module still exists and still contains what the claim depends on — so a
 * refactor that removes a protection breaks this page rather than leaving it
 * quietly advertising something OCADE no longer does.
 *
 * WHAT IS ABSENT AND WHY. There is no dedicated security mailbox on this page,
 * because none has been activated and verified; claiming one would send a
 * vulnerability report into a void. The disclosure route offered is the one
 * that genuinely works today.
 */
function SecurityPage() {
  return (
    <PublicPage
      eyebrow="Security"
      title="How OCADE protects your work"
      summary="What is encrypted, what stays on your device, who can reach your account, and how to tell us about a vulnerability. Every statement here describes something OCADE implements today."
    >
      <Notice>
        <p className="text-sm">
          OCADE holds no security certification and has commissioned no independent penetration
          test. There is no SOC 2 report, no ISO 27001 certificate, and no compliance badge, because
          none has been earned. This page describes the architecture, not an audit of it.
        </p>
      </Notice>

      {SECURITY_POSTURE.map((group) => (
        <PublicSection key={group.id} title={group.title}>
          {group.statements.map((statement) => (
            <p key={statement.claim}>
              <strong className="text-foreground">{statement.claim}</strong> {statement.detail}
            </p>
          ))}
          {group.limitation ? (
            <p className="text-muted-foreground">
              <strong className="text-foreground">Limitation.</strong> {group.limitation}
            </p>
          ) : null}
        </PublicSection>
      ))}

      <PublicSection title="Reporting a vulnerability">
        <p>{SECURITY_DISCLOSURE.route}</p>
        <p>{SECURITY_DISCLOSURE.expectations}</p>
        <p className="text-muted-foreground">{SECURITY_DISCLOSURE.contactStatus}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/support"
            className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
          >
            Support and contact
          </Link>
          <Link
            to="/settings/support"
            className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
          >
            Open a Security ticket
          </Link>
        </div>
      </PublicSection>

      <PublicSection title="Incident history">
        <p>
          OCADE does not publish an incident history. That is a statement about what is published,
          not a claim that there have been no incidents — an empty page must never be read as a
          clean record.
        </p>
        <p>
          Current component checks are on the{" "}
          <Link to="/status" className="underline">
            status page
          </Link>
          , which runs from OCADE's own origin and is not an independent status service.
        </p>
      </PublicSection>

      <PublicSection title="Providers that can process your data">
        <p>
          Depending on the features you use, OCADE relies on Supabase for accounts and account data,
          Cloudflare for delivery, a payment provider for purchases, and — only if you sign in that
          way — Google for authentication. The privacy notice is the authoritative list and states
          what each one receives.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/privacy"
            className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
          >
            Privacy notice
          </Link>
          <Link
            to="/data-rights"
            className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
          >
            Data-rights request
          </Link>
        </div>
      </PublicSection>
    </PublicPage>
  );
}
