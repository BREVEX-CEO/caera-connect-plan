import { createFileRoute } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — CARCC CADANE" },
      { name: "description", content: "Truthful pre-launch careers information for CARCC CADANE." },
    ],
  }),
  component: CareersPage,
});

function CareersPage() {
  return (
    <PublicPage
      eyebrow="Careers"
      title="Build the next era carefully"
      summary="CARCC CADANE is a founder-led pre-launch venture in Bengaluru. This page publishes the current hiring state without inventing a team, employee benefits or vacancies."
    >
      <PublicSection title="Company story">
        <p>
          Haans Antoni is building OCADE as a local-first AI workspace with supervised computer
          work. The planned public launch is 28 August 2026; incorporation and employer status are
          not claimed before independent verification.
        </p>
      </PublicSection>
      <PublicSection title="Teams and work">
        <p>
          Current product work spans local intelligence, desktop and browser control, mobile
          continuity, product design, safety, privacy and production operations. These are
          workstreams, not a claim that staffed divisions already exist.
        </p>
        <p>
          The operating base is Bengaluru, Karnataka. No office attendance, remote-work or
          relocation policy is promised before an employing entity and role terms exist.
        </p>
      </PublicSection>
      <PublicSection title="Benefits">
        <p>
          No employee-benefit programme is published yet. Compensation, leave, insurance, equipment,
          location and working-time terms must appear in a verified role description and written
          offer before anyone relies on them.
        </p>
      </PublicSection>
      <PublicSection title="Open roles">
        <p role="status">
          There are no verified job openings today. CARCC CADANE is not accepting speculative
          applications or collecting candidate personal data through this site.
        </p>
      </PublicSection>
      <PublicSection title="Employee perspectives">
        <p>
          There are no employee testimonials because no employee roster has been verified. Customer
          quotes, investor logos and review badges are also intentionally absent rather than
          fabricated.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
