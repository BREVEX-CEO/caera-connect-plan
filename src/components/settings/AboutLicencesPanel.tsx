import { useMemo } from "react";
import { Info, Scale, Package, Cpu } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { OCADE_IDENTITY } from "@/lib/ocade-identity";
import summaryJson from "../../../release/THIRD_PARTY_SUMMARY.json";
import manifestJson from "../../../release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";
import { OCADE_MODEL_ID } from "@/lib/local/fixed-model";

/**
 * About and licences.
 *
 * This is the ONE place in the product where the real model names appear.
 * Everywhere else OCADE refers to its engines by capability — "OCADE Local",
 * "OCADE Local Vision" — because a user chatting does not need to think about
 * weights. But the weights are third-party work under real licences, and the
 * manifest states plainly that "the licence text for each tier is fetched and
 * hashed and must remain reachable from the product UI before any tier is
 * offered for download". This page is what makes that true.
 *
 * Nothing here is hand-typed. The dependency figures come from a scan of the
 * installed tree; the model rows come from the manifest that was resolved
 * against the runtime's own registry. A hand-maintained version of either
 * would drift from what actually ships, and a licence page that has drifted is
 * worse than none because it looks authoritative.
 */

interface LicenceSummary {
  product: string;
  productionPackages: number;
  licenceTypes: number;
  needingReview: { package: string; licence: string | null }[];
  undetermined: string[];
  byLicence: Record<string, number>;
  fullNoticesPath: string;
}

interface ManifestTierRow {
  id: string;
  tag: string;
  deviceClass: string;
  resolved: boolean;
  quantization: string | null;
  model?: { gib?: number };
  licence?: { identifierGuess?: string | null; firstLine?: string | null } | null;
}

const summary = summaryJson as unknown as LicenceSummary;
/*
 * THE LICENCE TABLE SHOWS WHAT OCADE SHIPS, WHICH IS ONE MODEL.
 *
 * It used to render every row in the manifest — five engines, five device
 * classes — which told the reader that OCADE picks between them. It does not,
 * and has not since selection was removed. A licensing page that lists four
 * models the product never loads is not thorough, it is wrong.
 *
 * The manifest still carries all five because it is a resolved registry
 * artefact with provenance; the filter is here, at the point of display.
 */
const manifest = manifestJson as unknown as {
  registry: string;
  ownership: string;
  provenance: string;
  tiers: ManifestTierRow[];
};

const shippedTiers = manifest.tiers.filter((tier) => tier.tag === OCADE_MODEL_ID);

export function AboutLicencesPanel() {
  const topLicences = useMemo(
    () =>
      Object.entries(summary.byLicence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [],
  );

  return (
    <>
      <PageHeader
        eyebrow="Application"
        title="About and licences"
        description="What this build is, which model weights it can install, and the licences of everything it ships."
        actions={<StatusBadge status="active">{summary.product}</StatusBadge>}
      />

      <div className="grid gap-5 pb-16">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">OCADE</h2>
          </div>
          <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Assistant</dt>
              <dd className="text-foreground">{OCADE_IDENTITY.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Developed by</dt>
              <dd className="text-foreground">{OCADE_IDENTITY.vendor}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Build</dt>
              <dd className="text-foreground">{summary.product}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {OCADE_IDENTITY.vendor} builds OCADE. It does not train the underlying model weights and
            does not claim to. In ordinary conversation OCADE refers to its engine by capability;
            the exact model answering any request is always available here and in diagnostics.
          </p>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Model weights</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{manifest.ownership}</p>
          <div className="mt-3 -mx-1 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-1 pb-2 font-medium">Runs on</th>
                  <th className="px-1 pb-2 font-medium">Model</th>
                  <th className="px-1 pb-2 font-medium">Size</th>
                  <th className="px-1 pb-2 font-medium">Quantisation</th>
                  <th className="px-1 pb-2 font-medium">Licence</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {shippedTiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-white/10">
                    <td className="px-1 py-2 text-foreground">Every device</td>
                    <td className="px-1 py-2 font-mono text-[12px]">{tier.tag}</td>
                    <td className="px-1 py-2">
                      {typeof tier.model?.gib === "number" ? `${tier.model.gib} GiB` : "—"}
                    </td>
                    <td className="px-1 py-2">{tier.quantization ?? "—"}</td>
                    <td className="px-1 py-2">
                      {tier.licence?.identifierGuess ?? "Not determined — check upstream"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Read from {manifest.registry}. {manifest.provenance}
          </p>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Bundled software</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {summary.productionPackages} production packages across {summary.licenceTypes} licence
            types.
          </p>
          <ul className="mt-3 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
            {topLicences.map(([licence, count]) => (
              <li key={licence} className="flex items-center justify-between gap-3">
                <span className="truncate text-foreground">{licence}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted-foreground">
            The complete notices, including each package's licence text as shipped, are in{" "}
            <span className="font-mono">{summary.fullNoticesPath}</span> in this build. They are
            generated from the installed dependency tree, so they cannot drift from what ships.
          </p>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Needing review before release</h2>
          </div>
          {summary.needingReview.length === 0 && summary.undetermined.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              No bundled package carries copyleft or undetermined terms.
            </p>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Called out so they cannot be lost in an alphabetical list. A person must confirm the
                obligations are met for the way this product is distributed.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                {summary.needingReview.map((entry) => (
                  <li key={entry.package}>
                    <span className="text-foreground">{entry.package}</span> — {entry.licence}
                  </li>
                ))}
                {summary.undetermined.map((name) => (
                  <li key={name}>
                    <span className="text-foreground">{name}</span> — licence could not be
                    determined
                  </li>
                ))}
              </ul>
            </>
          )}
        </GlassPanel>
      </div>
    </>
  );
}
