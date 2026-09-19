import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/shell/PublicPage";
import { PrivacyContent } from "@/components/legal/LegalContent";
import { PRIVACY_META } from "@/components/legal/legal-document-meta";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — OCADE" },
      {
        name: "description",
        content: "How OCADE by CARCC collects, stores and deletes your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPage title="Privacy Policy" intro={PRIVACY_META.summary} backToTop>
      <div className="space-y-4 text-sm leading-6 text-muted-foreground [&_h2]:mt-8 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <PrivacyContent />
      </div>
    </PublicPage>
  );
}
