import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { OcadeBreadcrumbs } from "@/components/ui/ocade-breadcrumbs";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare OCADE — local-first AI workspace" },
      {
        name: "description",
        content:
          "A factual comparison of OCADE's local-first product boundaries with common AI workspace categories.",
      },
    ],
  }),
  component: ComparePage,
});

const ROWS = [
  [
    "Default inference route",
    "On-device desktop or browser engine",
    "Remote provider",
    "On-device model",
  ],
  [
    "Current information",
    "Permissioned retrieval with source labels",
    "Usually built in",
    "Usually manual",
  ],
  [
    "Computer work",
    "Permissioned, supervised, with STOP and receipts",
    "Varies by service",
    "Not normally included",
  ],
  [
    "Private synchronization",
    "Optional; Device Only remains available",
    "Account cloud by default",
    "Usually manual",
  ],
  [
    "Offline behavior",
    "Available where the selected local engine is ready",
    "Generally unavailable",
    "Core capability",
  ],
  [
    /*
     * The figures, not a description of them. This row said
     * "$4.28 / $28 / $128 planned" — the prices of a catalogue that no longer
     * exists — on a public comparison page, which made it a false statement
     * about what OCADE costs rather than a stale label.
     */
    "Price",
    "Free, or Pro from $8/week and Max from $28/week; checkout not open yet",
    "Provider-specific",
    "Software and hardware vary",
  ],
] as const;

export function ComparePage() {
  return (
    <PublicPage
      eyebrow="Product comparison"
      title="Local intelligence, supervised work"
      summary="OCADE combines a local-first inference route with projects, files, current-information retrieval and permissioned computer work. This table compares product categories, not unverifiable competitor claims."
    >
      <OcadeBreadcrumbs
        items={[
          { label: "OCADE", to: "/products/ocade" },
          { label: "Comparison: local and cloud workspace categories" },
        ]}
      />
      <PublicSection title="Positioning">
        <p>
          Choose OCADE when you want one workspace that can answer locally and prepare or execute
          supervised work. Choose a cloud AI workspace when remote hosted models are acceptable.
          Choose a standalone local runner when model execution matters more than an integrated
          workspace.
        </p>
      </PublicSection>
      <section
        aria-labelledby="comparison-title"
        className="overflow-hidden rounded-2xl border border-white/7"
      >
        <h2 id="comparison-title" className="sr-only">
          Feature comparison table
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-left text-xs">
            <thead className="bg-white/[0.04]">
              <tr>
                <th className="p-3">Capability</th>
                <th className="p-3">OCADE</th>
                <th className="p-3">Typical cloud AI workspace</th>
                <th className="p-3">Standalone local runner</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]} className="border-t border-white/7">
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      className={`p-3 align-top ${index === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <PublicSection title="Key differentiators">
        <ul className="list-disc space-y-2 pl-5">
          <li>Local execution is the default route, not a privacy-mode add-on.</li>
          <li>
            Computer actions require explicit scope and keep STOP, PAUSE and TAKE OVER visible.
          </li>
          <li>
            Failure states name the unavailable engine or provider instead of silently switching to
            public-cloud inference.
          </li>
        </ul>
      </PublicSection>
      <PublicSection title="Next step">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="inline-flex min-h-10 items-center rounded-lg border border-border/70 px-4 text-foreground"
          >
            Compare planned pricing
          </Link>
          <Link
            to="/auth"
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
          >
            Create a free account
          </Link>
        </div>
      </PublicSection>
    </PublicPage>
  );
}
