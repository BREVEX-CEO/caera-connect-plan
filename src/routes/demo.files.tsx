import { createFileRoute } from "@tanstack/react-router";
import { FileText, Ban, Upload } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useDemo } from "@/lib/demo/context";

export const Route = createFileRoute("/demo/files")({
  component: DemoFiles,
});

function DemoFiles() {
  const { state } = useDemo();
  return (
    <DemoShell>
      <PageHeader
        eyebrow="Files — demo"
        title="Sample files"
        description="Demo files are illustrative. Uploads, downloads and sharing are disabled in demo."
      />
      <GlassPanel className="mt-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/60 p-3 text-xs text-muted-foreground">
          <Ban className="h-3.5 w-3.5 text-[color:var(--state-warning)]" aria-hidden />
          Uploads disabled in demo.
          <button
            disabled
            title="Uploads are disabled in demo mode. Sign in to upload real files."
            aria-label="Upload (disabled in demo mode)"
            className="ml-auto inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border/60 bg-background/30 px-2 py-1 opacity-60"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
          </button>
        </div>
        <ul className="divide-y divide-border/40">
          {state.files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="flex-1 text-foreground">{f.name}</span>
              <span className="text-xs text-muted-foreground">{f.size}</span>
              <span className="text-xs text-muted-foreground">{f.updated}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </DemoShell>
  );
}
