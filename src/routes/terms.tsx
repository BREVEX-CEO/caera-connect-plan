import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { TermsContent, TERMS_META } from "@/components/legal/LegalContent";

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
  /*
   * The words live in `components/legal/LegalContent.tsx` so this page and the
   * in-site dialog on the signup form cannot drift apart.
   */
  return (
    <PublicPage eyebrow={TERMS_META.eyebrow} title={TERMS_META.title} summary={TERMS_META.summary}>
      <TermsContent />
    </PublicPage>
  );
}
