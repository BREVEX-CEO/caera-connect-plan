import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, FileDown, FileText, Loader2, Printer } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getResumeVersion } from "@/lib/madee.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyResume,
  ResumeContent,
  type ResumeContent as ResumeContentT,
} from "@/lib/madee-resume-types";
import { loadLocalResumeContent } from "@/lib/madee-local-store";
import { ResumePreview } from "@/components/madee/ResumePreview";
import { executeAction } from "@/lib/actions";
import { exportDocx, exportPdfViaPrint } from "@/lib/madee-export";

export const Route = createFileRoute("/_authenticated/madee/$projectId/preview")({
  head: () => ({
    meta: [{ title: "Resume preview — MADEE" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s) =>
    z
      .object({
        compare: z.coerce.number().optional(),
        a: z.string().uuid().optional(),
        b: z.string().uuid().optional(),
      })
      .parse(s),
  component: PreviewPage,
});

type Project = {
  id: string;
  title: string;
  storage_mode: "browser_only" | "private_sync";
  current_version_id: string | null;
};

function PreviewPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const getVersion = useServerFn(getResumeVersion);

  const projectQ = useQuery({
    queryKey: ["madee", "project", projectId],
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from("madee_resume_projects")
        .select("id, title, storage_mode, current_version_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });

  const project = projectQ.data;
  const primaryId = search.compare ? search.a : project?.current_version_id;
  const secondaryId = search.compare ? search.b : null;

  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [primary, setPrimary] = useState<ResumeContentT>(emptyResume());
  const [secondary, setSecondary] = useState<ResumeContentT | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!project) return;
      async function load(id: string | null | undefined): Promise<ResumeContentT | null> {
        if (!id) return null;
        if (project!.storage_mode === "browser_only") {
          return (await loadLocalResumeContent(id)) ?? emptyResume();
        }
        const v = await getVersion({ data: { id } });
        const parsed = ResumeContent.safeParse(v?.content ?? {});
        return parsed.success ? parsed.data : emptyResume();
      }
      try {
        const [p, s] = await Promise.all([load(primaryId), load(secondaryId)]);
        if (cancel) return;
        setPrimary(p ?? emptyResume());
        setSecondary(s);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load version");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [project, primaryId, secondaryId, getVersion]);

  if (!project) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  const compare = !!search.compare;

  return (
    <AppShell>
      <PageHeader
        eyebrow="MADEE — Preview"
        title={project.title}
        description={
          compare
            ? "Comparing two versions side by side."
            : "This is exactly what your export looks like."
        }
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button asChild variant="ghost">
              <Link to="/madee/$projectId" params={{ projectId: project.id }}>
                <ArrowLeft className="h-4 w-4" /> Back to editor
              </Link>
            </Button>
            <div className="flex overflow-hidden rounded-md border border-border/60">
              <Button
                size="sm"
                variant={device === "desktop" ? "secondary" : "ghost"}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </Button>
              <Button
                size="sm"
                variant={device === "mobile" ? "secondary" : "ghost"}
                onClick={() => setDevice("mobile")}
              >
                Mobile
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                await executeAction("madee.resume.export_pdf", {
                  run: async () => {
                    exportPdfViaPrint();
                    return true;
                  },
                });
              }}
            >
              <Printer className="h-4 w-4" /> Export PDF
            </Button>
            <Button
              onClick={async () => {
                try {
                  await executeAction("madee.resume.export_docx", {
                    run: () => exportDocx(project.title, primary),
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "DOCX export failed");
                }
              }}
            >
              <FileDown className="h-4 w-4" /> Export DOCX
            </Button>
          </div>
        }
      />

      <div className={`mt-6 ${compare ? "grid gap-4 lg:grid-cols-2" : ""}`}>
        <div className={device === "mobile" ? "mx-auto max-w-[420px]" : ""}>
          {compare && <SubHead label="Version A" />}
          <ResumePreview resume={primary} />
        </div>
        {compare && (
          <div className={device === "mobile" ? "mx-auto max-w-[420px]" : ""}>
            <SubHead label="Version B" />
            <ResumePreview resume={secondary ?? emptyResume()} />
          </div>
        )}
      </div>

      {!compare && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground print:hidden">
          <FileText className="h-4 w-4" />
          PDF export uses your browser's print → "Save as PDF" for a deterministic result. DOCX is
          generated locally.
        </div>
      )}
    </AppShell>
  );
}

function SubHead({ label }: { label: string }) {
  return (
    <div className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground print:hidden">
      {label}
    </div>
  );
}
