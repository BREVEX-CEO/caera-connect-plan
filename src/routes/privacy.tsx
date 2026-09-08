import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { PrivacyContent } from "@/components/legal/LegalContent";
import { PRIVACY_META } from "@/components/legal/legal-document-meta";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy notice — OCADE" },
      {
        name: "description",
        content: "Current Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPage
      eyebrow={PRIVACY_META.eyebrow}
      title={PRIVACY_META.title}
      summary={PRIVACY_META.summary}
    >
      <PrivacyContent />
    </PublicPage>
  );
}
