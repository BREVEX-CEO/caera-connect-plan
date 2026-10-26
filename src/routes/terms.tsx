import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/shell/PublicPage";
import { TermsContent } from "@/components/legal/LegalContent";
import { TERMS_META } from "@/components/legal/legal-document-meta";

export const Route = createFileRoute("/terms")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://ocade.in/terms" }],
    meta: [
      { title: "Terms & Conditions — OCADE" },
      {
        name: "description",
        content: "Current Terms & Conditions for OCADE by CARCC.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicPage
      title="Terms & Conditions"
      updated={TERMS_META.eyebrow}
      intro={TERMS_META.summary}
      backToTop
    >
      <div className="space-y-4 text-sm leading-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <TermsContent />
      </div>
    </PublicPage>
  );
}
