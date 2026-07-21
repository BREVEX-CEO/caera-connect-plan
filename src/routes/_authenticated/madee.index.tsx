import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, FileText, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  deleteResumeProject, duplicateResumeProject, listResumeProjects,
} from "@/lib/madee.functions";
import { executeAction } from "@/lib/actions";
import { isDemoActive } from "@/lib/demo/context";

export const Route = createFileRoute("/_authenticated/madee/")({
  head: () => ({ meta: [{ title: "MADEE Studio — CAERA CADANE" }, { name: "robots", content: "noindex" }] }),
  component: MadeeIndex,
});

function MadeeIndex() {
  const list = useServerFn(listResumeProjects);
  const del = useServerFn(deleteResumeProject);
  const dup = useServerFn(duplicateResumeProject);
  const router = useRouter();
  const demo = useDemo();

  const q = useQuery({
    queryKey: ["madee", "projects"],
    queryFn: () => list({}),
  });

  const projects = q.data ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="MADEE — Studio"
        title="Resume projects"
        description="Every resume is saved to your account. Open a project to edit it, keep versions, and export a clean PDF or editable DOCX."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/madee/new" search={{ upload: 1 }}>
                <Upload className="h-4 w-4" /> Upload resume
              </Link>
            </Button>
            <Button asChild>
              <Link to="/madee/new">
                <Plus className="h-4 w-4" /> New resume
              </Link>
            </Button>
          </div>
        }
      />

      {demo.enabled && (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
          Demo mode is on. Projects you create are still saved to your real account —
          use it to experiment safely with your own data.
        </div>
      )}

      <div className="mt-6">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="No resume projects yet"
            description="Start blank, or upload an existing PDF or Word document — MADEE will draft an editable version for you."
            action={
              <div className="flex gap-2">
                <Button asChild variant="secondary">
                  <Link to="/madee/new" search={{ upload: 1 }}>
                    <Upload className="h-4 w-4" /> Upload existing
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/madee/new">
                    <Sparkles className="h-4 w-4" /> Create new
                  </Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id} className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/madee/$projectId"
                      params={{ projectId: p.id }}
                      className="text-base font-semibold hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.profession || "General"} • {labelStorage(p.storage_mode)} • Updated{" "}
                      {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <DuplicateButton
                      onConfirm={async (title) => {
                        try {
                          await executeAction("madee.resume.duplicate", {
                            run: () => dup({ data: { id: p.id, newTitle: title } }),
                          });
                          toast.success("Duplicated");
                          router.invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Duplicate failed");
                        }
                      }}
                      defaultTitle={`${p.title} (copy)`}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Delete project">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <DeleteProjectDialog
                        title={p.title}
                        onConfirm={async (phrase) => {
                          try {
                            await executeAction("madee.resume.delete_project", {
                              run: () => del({ data: { id: p.id } }),
                              confirmed: true,
                              confirmPhrase: phrase,
                            });
                            toast.success("Deleted");
                            router.invalidate();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                      />
                    </AlertDialog>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function labelStorage(mode: string) {
  if (mode === "browser_only") return "Browser Only";
  return "Private Sync";
}

function DuplicateButton({
  defaultTitle, onConfirm,
}: { defaultTitle: string; onConfirm: (t: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} title="Duplicate">
        <Copy className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate resume</DialogTitle>
          <DialogDescription>Choose a name for the copy.</DialogDescription>
        </DialogHeader>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={busy || !title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(title.trim());
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  title, onConfirm,
}: { title: string; onConfirm: (phrase: string) => Promise<void> }) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
        <AlertDialogDescription>
          This deletes the project and every version. It cannot be undone. To confirm,
          type <b>delete resume</b> below.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <Input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="delete resume"
      />
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={busy || phrase !== "delete resume"}
          onClick={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onConfirm(phrase);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Delete permanently
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
