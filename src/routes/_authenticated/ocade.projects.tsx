import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderOpen,
  Plus,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
  Save,
  MessageSquare,
  FileOutput,
  ListChecks,
  Download,
  X,
  Paperclip,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { listTasks, type UnifiedTask } from "@/lib/tasks/unified-task";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createOutput,
  createProject,
  createProjectFolder,
  deleteOutput,
  deleteProject,
  deleteProjectFile,
  deleteProjectFolder as deleteProjectFolderRow,
  getOutput,
  listOutputs,
  listProjectFiles,
  listProjectFolders,
  listProjects,
  purgeExpiredOutputs,
  setConversationProject,
  saveProjectFile,
  updateProject,
  type OcadeOutput,
  type OcadeProject,
  type OcadeProjectFile,
  type OcadeProjectFolder,
} from "@/lib/ocade-projects.functions";
import {
  listConversations,
  updateConversation,
  type OcadeConversationRow,
} from "@/lib/ocade.functions";
import { useSession } from "@/lib/session";
import { deleteAttachment, describeSite, type DeletionPorts } from "@/lib/attachments/deletion";
import { forgetCitationsForSource } from "@/lib/ocade.functions";
import { useFormatters } from "@/lib/locale/use-formatters";

/**
 * How this screen reaches the places a deleted file left a trace.
 *
 * The deletion module takes these as ports so it carries no server-function
 * graph of its own and can be tested without one. Supplying the citation sweep
 * here is what makes "delete this file" also mean "and forget the sentences it
 * was quoted for" — an excerpt is small, which is exactly why it gets
 * forgotten, and it is still the reader's content.
 */
const deletionPorts: DeletionPorts = {
  forgetCitations: async (name) => (await forgetCitationsForSource({ data: { name } })).removed,
};

export const Route = createFileRoute("/_authenticated/ocade/projects")({
  head: () => ({
    meta: [{ title: "OCADE Projects — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectsPage,
});

interface OutputRow {
  id: string;
  kind: string;
  title: string;
  mime: string | null;
  size_bytes: number;
  created_at: string;
  lineage_id: string;
  version: number;
  content_sha256: string | null;
  expires_at: string | null;
}

type OutputKind = "document" | "export" | "visual" | "transcript" | "other";

function ProjectsPage() {
  const formatters = useFormatters();
  const { user } = useSession();
  const userId = user?.id ?? "";
  const [projects, setProjects] = useState<OcadeProject[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [instructions, setInstructions] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  const [conversations, setConversations] = useState<OcadeConversationRow[] | null>(null);
  const [unfiled, setUnfiled] = useState<OcadeConversationRow[] | null>(null);
  const [outputs, setOutputs] = useState<OutputRow[] | null>(null);
  /*
   * The work in progress, which the graph was missing.
   *
   * A project could show the conversation where a piece of work was agreed and
   * the artifact it eventually produced, and nothing about the task in between
   * — because `ocade_tasks` had no project link at all until this phase.
   */
  const [projectTasks, setProjectTasks] = useState<UnifiedTask[] | null>(null);
  const [projectFiles, setProjectFiles] = useState<OcadeProjectFile[] | null>(null);
  const [projectFolders, setProjectFolders] = useState<OcadeProjectFolder[] | null>(null);
  const [projectFileError, setProjectFileError] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [uploadFolder, setUploadFolder] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<OcadeProject | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    title: string;
    content: string | null;
    mime: string | null;
    kind: OutputKind;
  } | null>(null);
  const [previewDraft, setPreviewDraft] = useState("");
  const [outputRetention, setOutputRetention] = useState<"keep" | "30" | "90" | "365">("keep");
  const [savingVersion, setSavingVersion] = useState(false);

  const selected = projects?.find((p) => p.id === selectedId) ?? null;
  const visibleProjects =
    projects?.filter((project) =>
      project.name.toLowerCase().includes(projectSearch.trim().toLowerCase()),
    ) ?? [];
  const visibleProjectFiles = (projectFiles ?? []).filter((file) => {
    const query = fileSearch.trim().toLowerCase();
    return !query || `${file.folder}/${file.name}`.toLowerCase().includes(query);
  });

  const refreshProjects = useCallback(async () => {
    /*
     * WAIT FOR THE SESSION, AND RE-RUN WHEN IT ARRIVES.
     *
     * `useSession` resolves after first paint, so the first run of this effect
     * has no user id. Fetching anyway failed and set `unavailable`, and because
     * `userId` was not in the dependency list nothing ever retried — the page
     * would have said "Projects aren't available until the database is set up"
     * permanently, to a signed-in person whose database was fine.
     */
    if (!userId) return;
    setUnavailable(null);
    try {
      const all = (await listProjects()) as OcadeProject[];
      const rows = showArchived ? all : all.filter((project) => !project.archived);
      setProjects(rows);
      setSelectedId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : (rows[0]?.id ?? null)));
    } catch (e) {
      setProjects(null);
      setUnavailable(e instanceof Error ? e.message : "Projects could not be loaded.");
    }
  }, [showArchived, userId]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Load the selected project's contents.
  useEffect(() => {
    if (!selected) {
      setConversations(null);
      setOutputs(null);
      setProjectTasks(null);
      setProjectFiles(null);
      setProjectFolders(null);
      return;
    }
    setNameDraft(selected.name);
    setInstructions(selected.instructions ?? "");
    setUploadFolder("");
    setFolderDraft("");
    setFileSearch("");
    let live = true;
    void (async () => {
      try {
        /*
         * FIVE READS, ISSUED TOGETHER.
         *
         * They are independent — a project's files do not depend on its
         * conversations — so awaiting them in sequence would spend five round
         * trips to render one screen. `PLAN.md` Phase 18 names serialised
         * startup requests as one of the silent speed killers.
         */
        const [files, folders, allConversations, projectOutputs, allTasks] = await Promise.all([
          listProjectFiles({ data: { projectId: selected.id } }),
          listProjectFolders({ data: { projectId: selected.id } }),
          listConversations(),
          listOutputs({ data: { projectId: selected.id } }),
          listTasks(),
        ]);
        if (!live) return;
        setProjectFiles(files as OcadeProjectFile[]);
        setProjectFolders(folders as OcadeProjectFolder[]);
        setProjectFileError(null);
        const rows = (allConversations ?? []) as unknown as OcadeConversationRow[];
        setConversations(rows.filter((row) => row.project_id === selected.id));
        setUnfiled(rows.filter((row) => !row.project_id));
        setOutputs(projectOutputs as unknown as OutputRow[]);
        setProjectTasks(allTasks.filter((task) => task.projectId === selected.id));
      } catch (e) {
        if (!live) return;
        setProjectFiles(null);
        setProjectFolders(null);
        setProjectFileError(
          e instanceof Error ? e.message : "This project's contents could not be loaded.",
        );
        setConversations([]);
        setOutputs([]);
        setUnfiled([]);
        setProjectTasks([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [selected, userId]);

  /** Re-read a project's files and folders after something changed one. */
  const refreshProjectItems = useCallback(async (projectId: string) => {
    try {
      const [files, folders] = await Promise.all([
        listProjectFiles({ data: { projectId } }),
        listProjectFolders({ data: { projectId } }),
      ]);
      setProjectFiles(files as OcadeProjectFile[]);
      setProjectFolders(folders as OcadeProjectFolder[]);
      setProjectFileError(null);
    } catch (e) {
      setProjectFileError(
        e instanceof Error ? e.message : "This project's files could not be re-read.",
      );
    }
  }, []);

  async function addProjectFiles(files: FileList | null) {
    if (!selected || !files) return;
    for (const file of [...files]) {
      const textLike =
        file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|yaml|yml|log)$/i.test(file.name);
      if (!textLike) {
        toast.error(`${file.name}: add this through Chat first so OCADE can extract it safely.`);
        continue;
      }
      try {
        await saveProjectFile({
          data: {
            projectId: selected.id,
            name: file.name,
            mime: file.type || "text/plain",
            sizeBytes: file.size,
            text: await file.text(),
            folder: uploadFolder,
          },
        });
        toast.success(`${file.name} added to this project.`);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "could not be saved."}`);
      }
    }
    await refreshProjectItems(selected.id);
  }

  async function addProjectFolder() {
    if (!selected) return;
    const path = folderDraft.trim();
    if (!path) return;
    try {
      const created = (await createProjectFolder({
        data: { projectId: selected.id, path },
      })) as OcadeProjectFolder;
      setFolderDraft("");
      setUploadFolder(created.path);
      await refreshProjectItems(selected.id);
      toast.success(`Folder “${created.path}” is ready.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the folder.");
    }
  }

  async function deleteProjectFolder(folder: OcadeProjectFolder) {
    if (!selected) return;
    try {
      await deleteProjectFolderRow({ data: { id: folder.id } });
      if (uploadFolder === folder.path) setUploadFolder("");
      await refreshProjectItems(selected.id);
      toast.success(`Folder “${folder.path}” removed. Its files were kept.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the folder.");
    }
  }

  /**
   * Delete a project file from EVERY place it left a trace.
   *
   * The row is one of them. Verbatim excerpts of the same document also sit in
   * saved citations under old assistant replies, and cached copies sit in Cache
   * Storage — so deleting only the row would show a success message while the
   * text stayed readable in the app.
   */
  async function deleteProjectFileEverywhere(file: OcadeProjectFile) {
    try {
      await deleteProjectFile({ data: { id: file.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this file.");
      return;
    }
    const receipt = await deleteAttachment({ fileId: file.id, name: file.name }, deletionPorts);
    if (selected) await refreshProjectItems(selected.id);

    if (receipt.complete) {
      toast.success(receipt.summary);
      return;
    }
    // Names the places that still hold data instead of a bare "failed", so a
    // retry is informed and the user knows exactly what remains.
    toast.error(receipt.summary, {
      description: receipt.remaining.map(describeSite).join(", "),
    });
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const p = (await createProject({ data: { name } })) as OcadeProject;
      toast.success(`Project “${p.name}” created.`);
      setNewName("");
      await refreshProjects();
      setSelectedId(p.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the project.");
    } finally {
      setCreating(false);
    }
  }

  async function saveDetails() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateProject({
        data: {
          id: selected.id,
          name: nameDraft.trim() || selected.name,
          instructions: instructions.trim() ? instructions : null,
        },
      });
      toast.success("Project saved.");
      await refreshProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(p: OcadeProject) {
    setBusy(true);
    try {
      await updateProject({ data: { id: p.id, archived: !p.archived } });
      toast.success(p.archived ? "Project restored." : "Project archived.");
      await refreshProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the project.");
    } finally {
      setBusy(false);
    }
  }

  async function reallyDelete(p: OcadeProject) {
    setBusy(true);
    try {
      /*
       * Sweep each file's OTHER traces before the row goes.
       *
       * Deleting the project removes its file rows through the foreign key and
       * nothing else. Read the names first — afterwards there is nothing left
       * to say which documents were quoted, and their excerpts would stay in
       * saved citations and Cache Storage with no record of what they belong to.
       */
      const doomed = (await listProjectFiles({
        data: { projectId: p.id },
      })) as OcadeProjectFile[];
      await deleteProject({ data: { id: p.id } });
      for (const file of doomed) {
        await deleteAttachment({ fileId: file.id, name: file.name }, deletionPorts);
      }
      setConfirmDelete(null);
      await refreshProjects();
      toast.success(
        doomed.length > 0
          ? `Project deleted, its conversations were kept and unfiled, and ${doomed.length} ${doomed.length === 1 ? "file" : "files"} removed.`
          : "Project deleted. Its conversations were kept and unfiled.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the project.");
    } finally {
      setBusy(false);
    }
  }

  async function moveConversation(conversationId: string, projectId: string | null) {
    try {
      await setConversationProject({ data: { conversationId, projectId } });
      toast.success(projectId ? "Conversation moved into the project." : "Conversation unfiled.");
      if (selected) {
        const all = (await listConversations()) as unknown as OcadeConversationRow[];
        setConversations(all.filter((row) => row.project_id === selected.id));
        setUnfiled(all.filter((row) => !row.project_id));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move the conversation.");
    }
  }

  async function openPreview(id: string) {
    try {
      const row = (await getOutput({ data: { id } })) as OcadeOutput;
      setPreview({
        id: row.id,
        title: row.title,
        content: row.content ?? null,
        mime: row.mime ?? null,
        kind: row.kind as OutputKind,
      });
      setPreviewDraft(row.content ?? "");
      setOutputRetention("keep");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this output.");
    }
  }

  function exportPreview() {
    if (!preview || !previewDraft) return;
    const blob = new Blob([previewDraft], { type: preview.mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.title.replace(/[^\w.-]+/g, "_") || "ocade-output"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveNewOutputVersion() {
    if (!preview || !selected || !previewDraft.trim()) return;
    setSavingVersion(true);
    try {
      const created = (await createOutput({
        data: {
          projectId: selected.id,
          parentOutputId: preview.id,
          kind: preview.kind,
          title: preview.title,
          content: previewDraft,
          mime: preview.mime,
          retentionDays: outputRetention === "keep" ? null : Number(outputRetention),
        },
      })) as OcadeOutput;
      toast.success(`Saved ${preview.title} as version ${created.version}.`);
      setOutputs(
        (await listOutputs({ data: { projectId: selected.id } })) as unknown as OutputRow[],
      );
      setPreview(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the new output version.",
      );
    } finally {
      setSavingVersion(false);
    }
  }

  async function removeOutput(id: string) {
    try {
      await deleteOutput({ data: { id } });
      toast.success("Output deleted.");
      if (selected) {
        setOutputs(
          (await listOutputs({ data: { projectId: selected.id } })) as unknown as OutputRow[],
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the output.");
    }
  }

  async function removeExpiredOutputs() {
    try {
      const result = await purgeExpiredOutputs();
      toast.success(
        result.removed > 0
          ? `${result.removed} expired ${result.removed === 1 ? "output" : "outputs"} deleted.`
          : "No expired outputs to delete.",
      );
      if (selected) {
        setOutputs(
          (await listOutputs({ data: { projectId: selected.id } })) as unknown as OutputRow[],
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove expired outputs.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Projects"
        description="Group conversations, instructions and generated outputs. Project instructions are applied to every chat in the project."
        actions={
          <label className="flex min-h-[24px] items-center gap-2 py-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--foreground)]"
            />
            Show archived
          </label>
        }
      />

      {unavailable ? (
        <SetupRequiredState
          title="Projects couldn't be loaded"
          description="Projects, their files and saved outputs live in your account. This is usually a connection problem rather than a missing setup step."
          detail={unavailable}
          status="failed"
          action={
            <button
              type="button"
              onClick={() => void refreshProjects()}
              className="rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent/30"
            >
              Try again
            </button>
          }
        />
      ) : (
        /*
         * THE SHELL RENDERS WHILE THE LIST LOADS.
         *
         * A full-page spinner replaced everything, including the box you type a
         * new project name into — which is local UI that never needed the
         * network. Worse, the session resolves after first paint, so there is
         * always a moment where the whole page is a spinner, and if a person is
         * signed out the moment lasts forever: no header controls, nothing to
         * press, nothing explaining why.
         *
         * THAT COMMENT WAS TRUE OF THE COLUMN AND NOT OF THE PAGE. An outer
         * `projects === null` branch still replaced the whole layout with the
         * same spinner, so the intent described here was defeated three lines
         * above it — and the list column below already has its own loading
         * state, which is the one that belongs. It became visible when
         * `useSession` started resolving a dynamic import: the shell had no
         * controls at all until the list arrived, on a page whose create box
         * never needed the network.
         */
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Project list + create */}
          <div className="flex flex-col gap-3">
            <GlassPanel className="p-3">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                  placeholder="New project name"
                  aria-label="New project name"
                  className="h-9 text-sm"
                />
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating || !newName.trim()}
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="sr-only">Create project</span>
                </Button>
              </div>
              <Input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="mt-2 h-8 text-xs"
              />
            </GlassPanel>

            {projects === null ? (
              <GlassPanel className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading projects…
              </GlassPanel>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-6 w-6" aria-hidden />}
                title="No projects yet"
                description="Create a project to group related conversations, files and outputs."
              />
            ) : (
              <nav aria-label="Projects" className="flex flex-col gap-1">
                {visibleProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    aria-current={p.id === selectedId ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                      p.id === selectedId
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{p.name}</span>
                    {p.archived ? (
                      <span className="ml-auto text-[9px] uppercase tracking-wide">Archived</span>
                    ) : null}
                  </button>
                ))}
                {visibleProjects.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No project matches “{projectSearch}”.
                  </p>
                ) : null}
              </nav>
            )}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="flex flex-col gap-5">
              <GlassPanel className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    aria-label="Project name"
                    className="h-9 max-w-sm text-sm"
                  />
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleArchive(selected)}
                      disabled={busy}
                    >
                      {selected.archived ? (
                        <>
                          <ArchiveRestore className="mr-1.5 h-4 w-4" /> Restore
                        </>
                      ) : (
                        <>
                          <Archive className="mr-1.5 h-4 w-4" /> Archive
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(selected)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="project-instructions"
                >
                  Project instructions — applied to every conversation in this project
                </label>
                <Textarea
                  id="project-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder="e.g. Always answer in British English and cite the source file."
                  className="text-sm"
                />
                <div>
                  <Button size="sm" onClick={() => void saveDetails()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </GlassPanel>

              {/* Conversations */}
              <GlassPanel className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" aria-hidden /> Conversations
                </h3>
                {conversations === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No conversations filed here yet. Move one from the list below.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {conversations.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40"
                      >
                        <Link to="/ocade" className="truncate text-foreground hover:underline">
                          {c.title}
                        </Link>
                        {c.pinned ? (
                          <span className="text-[9px] uppercase text-muted-foreground">Pinned</span>
                        ) : null}
                        <button
                          onClick={() => void moveConversation(c.id, null)}
                          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Unfile
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {unfiled && unfiled.length > 0 ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Unfiled conversations
                    </p>
                    <ul className="flex flex-col gap-1">
                      {unfiled.slice(0, 8).map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]"
                        >
                          <span className="truncate text-muted-foreground">{c.title}</span>
                          <button
                            onClick={() => void moveConversation(c.id, selected.id)}
                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Move here
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </GlassPanel>

              <GlassPanel className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  <h3 className="text-sm font-semibold">Project files</h3>
                  <label className="ml-auto cursor-pointer rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-accent">
                    Add text files
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,text/*"
                      className="hidden"
                      onChange={(event) => {
                        void addProjectFiles(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Stored on this device with SHA-256 fingerprints. These files are added to Chat
                  context when the conversation is filed in this project.
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Input
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addProjectFolder();
                    }}
                    placeholder="New folder, e.g. Research/Notes"
                    aria-label="New project folder"
                    className="h-8 min-w-[220px] flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={addProjectFolder}
                    disabled={!folderDraft.trim()}
                  >
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Create folder
                  </Button>
                </div>
                {projectFolders && projectFolders.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    <button
                      aria-pressed={uploadFolder === ""}
                      type="button"
                      onClick={() => setUploadFolder("")}
                      className={cn(
                        "rounded border px-2 py-1 text-[10px]",
                        uploadFolder === "" ? "border-foreground/40" : "border-border/60",
                      )}
                    >
                      Root
                    </button>
                    {projectFolders.map((folder) => (
                      <span
                        key={folder.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]",
                          uploadFolder === folder.path
                            ? "border-foreground/40"
                            : "border-border/60",
                        )}
                      >
                        <button type="button" onClick={() => setUploadFolder(folder.path)}>
                          {folder.path}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteProjectFolder(folder)}
                          aria-label={`Delete folder ${folder.path}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    New files go to {uploadFolder || "project root"}
                  </span>
                  <Input
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                    placeholder="Search project files"
                    aria-label="Search project files"
                    className="ml-auto h-7 max-w-[220px] text-[11px]"
                  />
                </div>
                {projectFileError ? (
                  <p className="text-xs text-destructive">{projectFileError}</p>
                ) : projectFiles === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : projectFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No readable project files yet.</p>
                ) : visibleProjectFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No project file matches this search.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {visibleProjectFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                      >
                        <span className="truncate">
                          {file.folder ? `${file.folder}/` : ""}
                          {file.name}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {file.content_sha256.slice(0, 10)}…
                        </span>
                        <button
                          onClick={() => void deleteProjectFileEverywhere(file)}
                          aria-label={`Delete ${file.name}`}
                          className="ml-auto text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>

              {/*
                Tasks. The middle of the graph: what is being done, between the
                conversation where it was agreed and the artifact it produces.
                Read-only here on purpose — the board owns editing a task, and a
                second place to change status is a second thing to keep right.
              */}
              <GlassPanel className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <ListChecks className="h-4 w-4" aria-hidden /> Tasks
                  </h3>
                  <Link
                    to="/ocade/tasks"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Open the board
                  </Link>
                </div>
                {projectTasks === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : projectTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing filed here yet. Open a task on the board and file it under this project.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {projectTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]"
                      >
                        <span className="truncate">{task.title}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {task.status.replaceAll("_", " ").toLowerCase()}
                        </span>
                        {task.scheduledFor ? (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {formatters.dateTime(task.scheduledFor)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>

              {/* Outputs */}
              <GlassPanel className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <FileOutput className="h-4 w-4" aria-hidden /> Outputs
                  </h3>
                  <button
                    type="button"
                    onClick={() => void removeExpiredOutputs()}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Remove expired
                  </button>
                </div>
                {outputs === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : outputs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing generated yet. Documents and exports OCADE creates in this project
                    appear here.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {outputs.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40"
                      >
                        <button
                          onClick={() => void openPreview(o.id)}
                          className="truncate text-left hover:underline"
                        >
                          {o.title}
                        </button>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {o.kind}
                        </span>
                        <span className="text-[10px] text-muted-foreground">v{o.version}</span>
                        {o.content_sha256 ? (
                          <span
                            className="hidden font-mono text-[9px] text-muted-foreground lg:inline"
                            title={`SHA-256 ${o.content_sha256}`}
                          >
                            {o.content_sha256.slice(0, 10)}…
                          </span>
                        ) : null}
                        {o.expires_at ? (
                          <span className="text-[9px] text-muted-foreground">
                            expires {formatters.date(o.expires_at)}
                          </span>
                        ) : null}
                        <button
                          onClick={() => void removeOutput(o.id)}
                          aria-label={`Delete ${o.title}`}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>
          ) : (
            <EmptyState
              icon={<FolderOpen className="h-6 w-6" aria-hidden />}
              title="Select a project"
              description="Choose a project on the left, or create one to get started."
            />
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{confirmDelete?.name}” will be permanently deleted. Conversations inside it are{" "}
            <span className="font-medium text-foreground">kept</span> and become unfiled. This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDelete && void reallyDelete(confirmDelete)}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview?.content !== null ? (
            <>
              <label
                htmlFor="output-version-content"
                className="text-xs font-medium text-foreground"
              >
                Output content
              </label>
              <Textarea
                id="output-version-content"
                value={previewDraft}
                onChange={(event) => setPreviewDraft(event.target.value)}
                rows={14}
                className="max-h-[50vh] font-mono text-xs"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Editing does not overwrite this version. Save creates the next hashed version.
                </span>
                <label className="flex shrink-0 items-center gap-2">
                  Retention
                  <select
                    value={outputRetention}
                    onChange={(event) =>
                      setOutputRetention(event.target.value as "keep" | "30" | "90" | "365")
                    }
                    className="rounded border border-border/60 bg-background px-2 py-1 text-foreground"
                  >
                    <option value="keep">Keep</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This output has no inline preview. Export it to view the full file.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              <X className="mr-1.5 h-4 w-4" /> Close
            </Button>
            <Button variant="ghost" onClick={exportPreview} disabled={!previewDraft}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button
              onClick={() => void saveNewOutputVersion()}
              disabled={!previewDraft.trim() || savingVersion}
            >
              {savingVersion ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save new version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/*
        WHAT `/ocade/knowledge` EXISTED TO SAY.

        §4: "knowledge into Settings or Customize. Project files ARE the
        knowledge a person adds, so it belongs with Projects rather than beside
        it." The page itself was one honest paragraph and three links to
        screens that already exist; this is the paragraph, where the files it
        is about actually live.
      */}
      <p className="mt-8 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
        OCADE keeps no always-on index across every file and conversation you own. A project&rsquo;s
        instructions and its files are what a conversation in that project can draw on, and Search
        looks through what you have written — neither is a hidden retrieval service reading
        everything in the background.
      </p>
    </>
  );
}
