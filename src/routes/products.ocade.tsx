import { createFileRoute } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { CapabilityCarousel } from "@/components/public/CapabilityCarousel";
import { OCADE_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/products/ocade")({
  head: () => ({
    meta: [
      { title: "OCADE — Local-first AI workspace by CARCC CADANE" },
      {
        name: "description",
        content:
          "Official product information for OCADE, a local-first AI workspace by CARCC CADANE. Formal public launch date: 28 August 2026.",
      },
      { property: "og:title", content: "OCADE by CARCC CADANE — Command the Next Era." },
      {
        property: "og:description",
        content:
          "Local-first AI for chat, research, work and permissioned computer control, with optional Private Sync and current-information services.",
      },
    ],
  }),
  component: OcadePage,
});

function OcadePage() {
  return (
    <PublicPage
      eyebrow="Official OCADE product information"
      title={PUBLIC_IDENTITY.product}
      summary="OCADE is a cross-platform, local-inference AI workspace with optional Private Sync, user-authorized network services and permissioned computer-control features. CARCC CADANE records 28 August 2026 as OCADE's formal public-launch date."
      structuredData={OCADE_STRUCTURED_DATA}
    >
      <CapabilityCarousel />

      <PublicSection title="Private intelligence, permissioned action">
        <p>
          OCADE is designed for AI chat, research, work, creation and permissioned computer-control
          tasks. Supported AI generation is designed around local inference on the user's device
          rather than a public-cloud AI inference fallback.
        </p>
        <p>
          Optional authentication, Private Sync, current-information retrieval, support, payment and
          user-authorized network features are separate from the normal local AI path.
        </p>
      </PublicSection>

      <PublicSection title="What exists across the product">
        <p>
          The repository contains the web application and offline shell, Supabase-backed account and
          private-sync paths, on-device model routing, Capacitor Android and iOS projects, desktop
          components, browser-control components and release infrastructure. Source presence and
          passing tests do not by themselves prove that every installer, app-store build or external
          production service is available at the same moment.
        </p>
      </PublicSection>

      <PublicSection title="Name and meaning">
        <p>
          OCADE is pronounced “OH-kayd.” Its creator, Haans Antoni, defines OCADE as “Orbital-scale
          command and autonomous decision engine.” This is the intended brand meaning and not a
          promise that every autonomous capability is enabled in every production release.
        </p>
      </PublicSection>

      <PublicSection title="Offline and network behavior">
        <p>
          Supported OCADE Chat generation is designed to run locally; public-cloud AI inference is
          not a fallback. Local capability depends on device support and installed models. Sign-in,
          Private Sync, live web requests, payments and other requested online services require a
          network.
        </p>
        <p>
          An offline web shell can preserve supported interface access after a successful visit, but
          it does not make every connector, search source or online account feature available
          offline.
        </p>
      </PublicSection>

      <PublicSection title="AI and computer-control limitations">
        <p>
          AI can be inaccurate, incomplete or wrong. Permissioned computer-control features can also
          select the wrong control or perform an unintended action. Important output and important
          actions must be reviewed. OCADE should not be relied on alone for medical, legal, tax,
          accounting, investment, cybersecurity, emergency or other high-impact decisions.
        </p>
      </PublicSection>

      <PublicSection title="Launch access, plans and devices">
        <p>
          OCADE may initially be available without charge while final product and payment work is
          completed. Paid plans may be introduced later only with purchase-specific pricing,
          renewal, cancellation and refund information shown before checkout.
        </p>
        <p>
          Device limits, plan entitlements and platform availability can change as OCADE moves from
          launch into later releases. Current production rules, not screenshots or old roadmaps,
          determine what is available to an account.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
