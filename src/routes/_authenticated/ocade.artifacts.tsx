import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Package,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Download,
  Loader2,
  Eye,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  inspectArtifactStore,
  removeArtifact,
  verifyIntegrity,
  exportFilename,
  describeArtifact,
  setArtifactRetention,
  purgeExpiredArtifacts,
  type Artifact,
} from "@/lib/artifacts/store";
import {
  groupIntoLineages,
  restoreVersion,
  type ArtifactVersion,
  type Lineage,
} from "@/lib/artifacts/versioning";

export const Route = createFileRoute("/_authenticated/ocade/artifacts")({
  head: () => ({
    meta: [{ title: "Artifacts — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: ArtifactsPage,
});

/**
 * A dedicated Artifacts surface — deliberately NOT a renamed link to Projects.
 *
 * The two things this page shows that a file list does not: whether the result
 * was verified when it was produced (carried permanently on the record), and
 * whether the bytes are still what were written (checked live, by re-hashing).
 *
 * Everything runs on-device against `artifacts/store.ts`. Nothing here uploads.
 */
function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Record<string, "checking" | "intact" | "changed">>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const result = inspectArtifactStore();
    if (result.ok) {
      setArtifacts(result.data);
      setLoadError(null);
    } else {
      setArtifacts(null);
      setLoadError(result.reason);
    }
  }, []);
  useEffect(refresh, [refresh]);

  // Version histories, computed from the same records the list shows.
  const lineages = useMemo(() => groupIntoLineages(artifacts ?? []), [artifacts]);

  async function check(id: string) {
    setIntegrity((s) => ({ ...s, [id]: "checking" }));
    const r = await verifyIntegrity(id);
    if (!r.ok) {
      toast.error(r.reason);
      setIntegrity((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
      return;
    }
    setIntegrity((s) => ({ ...s, [id]: r.data.intact ? "intact" : "changed" }));
    toast[r.data.intact ? "success" : "error"](r.evidence);
  }

  function download(artifact: Artifact) {
    // A real file the browser saves — Blob + object URL, no network.
    const blob = new Blob([artifact.content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(artifact);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function remove(id: string) {
    const r = removeArtifact(id);
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    toast.success(r.evidence);
    refresh();
  }

  function changeRetention(id: string, value: string) {
    const result = setArtifactRetention(id, value === "keep" ? null : Number(value));
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(result.evidence);
    refresh();
  }

  function purgeExpired() {
    const result = purgeExpiredArtifacts();
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(result.evidence);
    refresh();
  }

  async function restore(version: ArtifactVersion) {
    const result = await restoreVersion(version);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(`Restored ${result.data.name} as a new current version.`);
    refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Artifacts"
        description="What OCADE produced, kept with its provenance. Every artifact records what made it, whether that step verified its own result, and a fingerprint you can re-check."
        actions={
          <Button size="sm" variant="ghost" onClick={purgeExpired}>
            Remove expired
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">
            Stored on this device. An artifact whose producing step could not confirm its own result
            is labelled <span className="font-medium text-foreground">NOT CONFIRMED</span> — every
            time it&rsquo;s shown, not once. Integrity is checked by re-hashing the content, so a
            file that changed after it was written is caught rather than trusted.
          </p>
        </GlassPanel>

        {loadError ? (
          <GlassPanel className="p-4 text-sm text-destructive">
            {loadError} Nothing was changed.
          </GlassPanel>
        ) : artifacts === null ? (
          <GlassPanel className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </GlassPanel>
        ) : artifacts.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" aria-hidden />}
            title="No artifacts yet"
            description="When OCADE produces something worth keeping — an exported model, a patch, a data summary — it appears here with its provenance and a fingerprint."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {artifacts.map((a) => {
              const state = integrity[a.id];
              const version = versionFor(lineages, a);
              const storedVersion = artifactVersionFor(lineages, a);
              return (
                <li key={a.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-[13px] font-medium">{a.name}</span>
                    {/* Version badge only when this name+kind has real history. */}
                    {version && version.total > 1 ? (
                      <span
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        title={`Version ${version.number} of ${version.total} for “${a.name}”`}
                      >
                        v{version.number} of {version.total}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        a.provenance.verified
                          ? "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]"
                          : "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)]",
                      )}
                    >
                      {a.provenance.verified ? "verified" : "not confirmed"}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {describeArtifact(a)}
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {a.kind} · sha256 {a.sha256.slice(0, 16)}… ·{" "}
                    {new Date(a.createdAt).toLocaleString("en-GB")}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Retention:{" "}
                    {a.expiresAt
                      ? `eligible for deletion after ${new Date(a.expiresAt).toLocaleString("en-GB")}`
                      : "keep until deleted"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Privacy: {a.privacyClass.replaceAll("_", " ")} Â· Compatible:{" "}
                    {a.compatibleApps.join(", ")}
                  </p>

                  {/* The producing step's own evidence, verbatim. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">{a.provenance.evidence}</p>

                  {state === "intact" ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[color:var(--state-success)]">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Byte-for-byte what was
                      written.
                    </p>
                  ) : state === "changed" ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[color:var(--state-warning)]">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Changed since it was
                      stored — don&rsquo;t rely on it.
                    </p>
                  ) : null}

                  {previewId === a.id ? (
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-secondary/30 p-3 text-[11px]">
                      {a.content.slice(0, 20_000)}
                      {a.content.length > 20_000
                        ? "\n\n[Preview limited to 20,000 characters]"
                        : ""}
                    </pre>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => setPreviewId((current) => (current === a.id ? null : a.id))}
                    >
                      <Eye className="mr-1.5 h-3 w-3" aria-hidden />
                      {previewId === a.id ? "Hide preview" : "Preview"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      disabled={state === "checking"}
                      onClick={() => void check(a.id)}
                    >
                      {state === "checking" ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <ShieldCheck className="mr-1.5 h-3 w-3" aria-hidden />
                      )}
                      Check integrity
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => download(a)}
                    >
                      <Download className="mr-1.5 h-3 w-3" aria-hidden /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-[color:var(--state-warning)]"
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="mr-1.5 h-3 w-3" aria-hidden /> Delete
                    </Button>
                    {storedVersion && !storedVersion.current ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => void restore(storedVersion)}
                      >
                        <RotateCcw className="mr-1.5 h-3 w-3" aria-hidden /> Restore as current
                      </Button>
                    ) : null}
                    <select
                      value="choose"
                      aria-label={`Set retention for ${a.name}`}
                      onChange={(event) => {
                        if (event.target.value !== "choose") {
                          changeRetention(a.id, event.target.value);
                        }
                      }}
                      className="h-7 rounded-md border border-border/60 bg-background px-2 text-[11px]"
                    >
                      <option value="choose" disabled>
                        Retention…
                      </option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="keep">Keep until deleted</option>
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Find an artifact's position in its version history.
 *
 * Returns null when the record has no history entry (e.g. it was collapsed as
 * an identical re-save) — the badge simply doesn't show, rather than inventing
 * a version number.
 */
function versionFor(
  lineages: Lineage[],
  artifact: Artifact,
): { number: number; total: number } | null {
  for (const lineage of lineages) {
    const v = lineage.versions.find((x) => x.artifact.id === artifact.id);
    if (v) return { number: v.number, total: lineage.versions.length };
  }
  return null;
}

function artifactVersionFor(lineages: Lineage[], artifact: Artifact): ArtifactVersion | null {
  for (const lineage of lineages) {
    const version = lineage.versions.find((candidate) => candidate.artifact.id === artifact.id);
    if (version) return version;
  }
  return null;
}
