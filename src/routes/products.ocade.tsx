import { createFileRoute } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { OCADE_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/products/ocade")({
  head: () => ({
    meta: [
      { title: "OCADE — Local-first AI workspace by CAERA CADANE" },
      {
        name: "description",
        content:
          "Official pre-launch product information for OCADE, a local-first AI workspace by CAERA CADANE.",
      },
    ],
  }),
  component: OcadePage,
});

function OcadePage() {
  return (
    <PublicPage
      eyebrow="Pre-launch product"
      title={PUBLIC_IDENTITY.product}
      summary="OCADE is a cross-platform AI workspace designed to use on-device processing where supported, with optional private synchronization and clearly disclosed cloud-assisted features. Public launch is planned for 28 August 2026."
      structuredData={OCADE_STRUCTURED_DATA}
    >
      <PublicSection title="What is implemented in source">
        <p>
          The private repository contains a web application and offline shell, Supabase-backed
          account and private-sync paths, optional cloud model routing, Capacitor Android and iOS
          projects, and Tauri/native desktop components. Source presence and passing tests do not by
          themselves prove that every installer, store build or production service is ready.
        </p>
      </PublicSection>
      <PublicSection title="Offline and cloud behavior">
        <p>
          OCADE is local-first, not cloud-free. Local capabilities depend on device support and
          installed models. Sign-in, private synchronization, live web requests, payments and
          cloud-assisted model use require a network. A service worker can preserve an offline web
          shell after a successful visit, but it does not make every feature available offline.
        </p>
      </PublicSection>
      <PublicSection title="Subscriptions and devices">
        <p>
          The entitlement source currently models up to two mobile and two desktop devices per
          subscription. Payment checkout is not yet a verified production service, so this page does
          not advertise a price or accept payment.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
