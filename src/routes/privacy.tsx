import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { PrivacyContent, PRIVACY_META } from "@/components/legal/LegalContent";

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
  /*
   * The words live in `components/legal/LegalContent.tsx` so this page and the
   * in-site dialog on the signup form cannot drift apart.
   */
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
