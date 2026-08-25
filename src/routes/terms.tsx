import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { TermsContent, TERMS_META } from "@/components/legal/LegalContent";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — OCADE" },
      {
        name: "description",
        content: "Current Terms of service for OCADE by CARCC CADANE, effective 25 August 2026.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicPage eyebrow={TERMS_META.eyebrow} title={TERMS_META.title} summary={TERMS_META.summary}>
      <TermsContent />
    </PublicPage>
  );
}
