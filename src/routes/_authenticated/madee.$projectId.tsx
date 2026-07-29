import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Eye, GitBranch, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createResumeVersion,
  deleteResumeVersion,
  getResumeVersion,
  listResumeVersions,
  renameResumeVersion,
  updateResumeProject,
} from "@/lib/madee.functions";
import {
  atsCheckResume,
  jobDescriptionMatch,
  type AtsResult,
  type JdMatchResult,
} from "@/lib/madee-ai.functions";
import { executeAction } from "@/lib/actions";
import {
  emptyResume,
  type ResumeContent,
  ResumeContent as ResumeContentSchema,
  type ExperienceLevel,
} from "@/lib/madee-resume-types";
import { loadLocalResumeContent, saveLocalResumeContent } from "@/lib/madee-local-store";
import { supabase } from "@/integrations/supabase/client";
import {
  AchievementsSection,
  CertificationsSection,
  EducationSection,
  LanguagesSection,
  LinksSection,
  PersonalSection,
  ProjectsSection,
  SkillsSection,
  WorkSection,
} from "@/components/madee/ResumeSections";
import { ResumePreview } from "@/components/madee/ResumePreview";

export const Route = createFileRoute("/_authenticated/madee/$projectId")({
  head: () => ({
    meta: [{ title: "Edit resume — MADEE" }, { name: "robots", content: "noindex" }],
  }),
  component: EditResume,
});

type Project = {
  id: string;
  title: string;
  profession: string | null;
  experience_level: ExperienceLevel | null;
  storage_mode: "browser_only" | "private_sync";
  current_version_id: string | null;
  target_role: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

function EditResume() {
  const { projectId } = Route.useParams();
  const router = useRouter();

  const listVersions = useServerFn(listResumeVersions);
  const getVersion = useServerFn(getResumeVersion);
  const createVer = useServerFn(createResumeVersion);
  const renameVer = useServerFn(renameResumeVersion);
  const deleteVer = useServerFn(deleteResumeVersion);
  const updateProj = useServerFn(updateResumeProject);
  const atsCheck = useServerFn(atsCheckResume);
  const jdMatch = useServerFn(jobDescriptionMatch);

  // We reuse Supabase directly for the project row (RLS enforces ownership).
  const projectQ = useQuery({
    queryKey: ["madee", "project", projectId],
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from("madee_resume_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });
  const versionsQ = useQuery({
    queryKey: ["madee", "versions", projectId],
    queryFn: () => listVersions({ data: { projectId } }),
  });

  const project = projectQ.data;
  const versions = versionsQ.data ?? [];
  const currentId = project?.current_version_id ?? versions[0]?.id ?? null;

  const [resume, setResume] = useState<ResumeContent>(emptyResume());
  const [loadedVersionId, setLoadedVersionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load current version content.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project || !currentId) return;
      if (loadedVersionId === currentId) return;
      try {
        if (project.storage_mode === "browser_only") {
          const local = await loadLocalResumeContent(currentId);
          if (!cancelled) {
            setResume(local ?? emptyResume());
            setLoadedVersionId(currentId);
            setDirty(false);
          }
        } else {
          const v = await getVersion({ data: { id: currentId } });
          if (cancelled) return;
          const parsed = ResumeContentSchema.safeParse(v?.content ?? {});
          setResume(parsed.success ? parsed.data : emptyResume());
          setLoadedVersionId(currentId);
          setDirty(false);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load version");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, currentId, loadedVersionId, getVersion]);

  const setResumeTracked = useMemo(
    () => (updater: (r: ResumeContent) => ResumeContent) => {
      setResume((prev) => {
        const next = updater(prev);
        setDirty(true);
        return next;
      });
    },
    [],
  );

  async function saveNewVersion(label: string | null) {
    if (!project) return;
    setSaving(true);
    try {
      const local = project.storage_mode === "browser_only";
      const v = await executeAction("madee.resume.save_version", {
        run: () =>
          createVer({
            data: {
              projectId: project.id,
              label,
              content: local ? undefined : resume,
              contentStoredLocally: local,
              setAsCurrent: true,
            },
          }),
      });
      if (local) await saveLocalResumeContent(v.id, resume);
      toast.success("Version saved");
      setDirty(false);
      setLoadedVersionId(v.id);
      versionsQ.refetch();
      projectQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (projectQ.isLoading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell>
        <PageHeader
          title="Resume not found"
          description="This project may have been deleted or you do not have access."
        />
        <Button asChild variant="secondary">
          <Link to="/madee">
            <ArrowLeft className="h-4 w-4" /> Back to projects
          </Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="MADEE — Resume"
        title={project.title}
        description={`${project.profession || "General"} • ${project.storage_mode === "browser_only" ? "Browser Only" : "Private Sync"}${dirty ? " • unsaved changes" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/madee/$projectId/preview" params={{ projectId: project.id }}>
                <Eye className="h-4 w-4" /> Preview & export
              </Link>
            </Button>
            <SaveVersionButton onSave={saveNewVersion} saving={saving} dirty={dirty} />
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              {SECTIONS.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="data-[state=active]:bg-muted">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="personal" className="mt-4">
              <PersonalSection
                resume={resume}
                setResume={setResumeTracked}
                profession={project.profession}
                experienceLevel={project.experience_level}
              />
            </TabsContent>
            <TabsContent value="work" className="mt-4">
              <WorkSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="education" className="mt-4">
              <EducationSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="skills" className="mt-4">
              <SkillsSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="projects" className="mt-4">
              <ProjectsSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="certs" className="mt-4">
              <CertificationsSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="achievements" className="mt-4">
              <AchievementsSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="languages" className="mt-4">
              <LanguagesSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="links" className="mt-4">
              <LinksSection resume={resume} setResume={setResumeTracked} />
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <AiPanel
                resume={resume}
                project={project}
                atsCheck={atsCheck}
                jdMatch={jdMatch}
                onSetTargetRole={async (v) => {
                  await updateProj({ data: { id: project.id, targetRole: v } });
                  projectQ.refetch();
                }}
              />
            </TabsContent>
            <TabsContent value="versions" className="mt-4">
              <VersionsPanel
                projectId={project.id}
                versions={versions}
                currentId={currentId}
                storageMode={project.storage_mode}
                onSwitch={async (vid) => {
                  await updateProj({ data: { id: project.id, currentVersionId: vid } });
                  projectQ.refetch();
                }}
                onRename={async (id, label) => {
                  await executeAction("madee.resume.rename_version", {
                    run: () => renameVer({ data: { id, label } }),
                  });
                  versionsQ.refetch();
                }}
                onDelete={async (id) => {
                  await executeAction("madee.resume.delete_version", {
                    run: () => deleteVer({ data: { id } }),
                    confirmed: true,
                  });
                  versionsQ.refetch();
                  projectQ.refetch();
                  if (loadedVersionId === id) setLoadedVersionId(null);
                }}
                onCompare={(a, b) => {
                  router.navigate({
                    to: "/madee/$projectId/preview",
                    params: { projectId: project.id },
                    search: { compare: 1, a, b },
                  });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Live preview
            </Label>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 max-h-[calc(100vh-8rem)] overflow-auto">
              <ResumePreview resume={resume} compact />
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

const SECTIONS = [
  { id: "personal", label: "Personal" },
  { id: "work", label: "Work" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "certs", label: "Certifications" },
  { id: "achievements", label: "Achievements" },
  { id: "languages", label: "Languages" },
  { id: "links", label: "Links" },
  { id: "ai", label: "AI review" },
  { id: "versions", label: "Versions" },
] as const;

function SaveVersionButton({
  onSave,
  saving,
  dirty,
}: {
  onSave: (label: string | null) => Promise<void>;
  saving: boolean;
  dirty: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button disabled={saving} onClick={() => setOpen(true)}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save version{dirty ? " *" : ""}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save a new version</DialogTitle>
          <DialogDescription>
            Add an optional label (e.g. "Applied Acme", "Tightened bullets").
          </DialogDescription>
        </DialogHeader>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={160}
          placeholder="Version label"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              await onSave(label.trim() || null);
              setOpen(false);
              setLabel("");
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- AI review panel -------------------- */

function AiPanel({
  resume,
  project,
  atsCheck,
  jdMatch,
  onSetTargetRole,
}: {
  resume: ResumeContent;
  project: Project;
  atsCheck: ReturnType<typeof useServerFn<typeof atsCheckResume>>;
  jdMatch: ReturnType<typeof useServerFn<typeof jobDescriptionMatch>>;
  onSetTargetRole: (v: string) => Promise<void>;
}) {
  const [ats, setAts] = useState<AtsResult | null>(null);
  const [jd, setJd] = useState<JdMatchResult | null>(null);
  const [jdText, setJdText] = useState("");
  const [busy, setBusy] = useState<"ats" | "jd" | null>(null);
  const [targetRole, setTargetRole] = useState(project.target_role ?? "");
  const savedRoleRef = useRef(project.target_role ?? "");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 p-4">
        <h3 className="font-semibold">ATS review</h3>
        <p className="text-xs text-muted-foreground">
          Runs an AI check for applicant-tracking-system compatibility against the current draft.
          Never invents credentials — only flags what's on the page.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <Label className="text-xs">Target role (optional)</Label>
            <Input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onBlur={async () => {
                if (targetRole !== savedRoleRef.current) {
                  await onSetTargetRole(targetRole);
                  savedRoleRef.current = targetRole;
                }
              }}
              maxLength={200}
            />
          </div>
          <Button
            disabled={busy !== null}
            onClick={async () => {
              setBusy("ats");
              try {
                const res = await executeAction("madee.resume.ai_ats", {
                  run: () =>
                    atsCheck({
                      data: {
                        resume: resume as unknown as Record<string, unknown>,
                        targetRole: targetRole || undefined,
                      },
                    }),
                });
                if (res.ok) setAts(res.result);
                else toast.error(res.error);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "AI request failed");
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "ats" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Run ATS check
          </Button>
        </div>
        {ats && <AtsResultView r={ats} />}
      </div>

      <div className="rounded-lg border border-border/60 p-4">
        <h3 className="font-semibold">Job-description match</h3>
        <p className="text-xs text-muted-foreground">
          Paste a job description. MADEE compares it against your draft — matched keywords, missing
          keywords, and tailoring tips.
        </p>
        <Textarea
          className="mt-2"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={6}
          maxLength={8000}
          placeholder="Paste the job description here…"
        />
        <div className="mt-2 flex justify-end">
          <Button
            disabled={busy !== null || jdText.trim().length < 20}
            onClick={async () => {
              setBusy("jd");
              try {
                const res = await executeAction("madee.resume.ai_jd_match", {
                  run: () =>
                    jdMatch({
                      data: {
                        resume: resume as unknown as Record<string, unknown>,
                        jobDescription: jdText,
                      },
                    }),
                });
                if (res.ok) setJd(res.result);
                else toast.error(res.error);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "AI request failed");
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "jd" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Match
          </Button>
        </div>
        {jd && <JdResultView r={jd} />}
      </div>
    </div>
  );
}

function AtsResultView({ r }: { r: AtsResult }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold">{r.score}</span>
        <span className="text-xs text-muted-foreground">/ 100 ATS friendliness</span>
      </div>
      <BulletBlock title="Strengths" items={r.strengths} />
      <BulletBlock title="Issues" items={r.issues} />
      <BulletBlock title="Suggestions" items={r.suggestions} />
    </div>
  );
}
function JdResultView({ r }: { r: JdMatchResult }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <div>
        <b>{r.matchScore}</b> / 100 match
      </div>
      <BulletBlock title="Matched keywords" items={r.matchedKeywords} />
      <BulletBlock title="Missing keywords" items={r.missingKeywords} />
      <BulletBlock title="Tailoring tips" items={r.tailoringTips} />
    </div>
  );
}
function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="ml-4 list-disc">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------- Versions panel -------------------- */

function VersionsPanel({
  projectId: _projectId,
  versions,
  currentId,
  storageMode,
  onSwitch,
  onRename,
  onDelete,
  onCompare,
}: {
  projectId: string;
  versions: Array<{
    id: string;
    version_number: number;
    label: string | null;
    content_stored_locally: boolean;
    created_at: string;
  }>;
  currentId: string | null;
  storageMode: "browser_only" | "private_sync";
  onSwitch: (id: string) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCompare: (a: string, b: string) => void;
}) {
  const [compareA, setCompareA] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Storage:{" "}
        {storageMode === "browser_only"
          ? "Browser Only — content lives in this browser."
          : "Private Sync — content available on approved devices."}
      </div>
      <ul className="space-y-2">
        {versions.map((v) => {
          const active = v.id === currentId;
          return (
            <li
              key={v.id}
              className={`rounded-lg border p-3 ${active ? "border-[color:var(--accent-madee)]" : "border-border/60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    v{v.version_number} {v.label ? `— ${v.label}` : ""}
                    {active && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">current</span>
                    )}
                    {v.content_stored_locally && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">local</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!active && (
                    <Button size="sm" variant="ghost" onClick={() => onSwitch(v.id)}>
                      <GitBranch className="h-4 w-4" /> Load
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!compareA) {
                        setCompareA(v.id);
                        toast("Pick a second version to compare");
                      } else if (compareA === v.id) {
                        setCompareA(null);
                        toast("Cleared");
                      } else {
                        onCompare(compareA, v.id);
                        setCompareA(null);
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />{" "}
                    {compareA === v.id ? "Cancel" : compareA ? "Compare with this" : "Compare…"}
                  </Button>
                  <RenameButton current={v.label ?? ""} onRename={(l) => onRename(v.id, l)} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" title="Delete version">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete version v{v.version_number}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Other versions remain. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(v.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RenameButton({
  current,
  onRename,
}: {
  current: string;
  onRename: (l: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(current);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setLabel(current);
      }}
    >
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Rename
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename version</DialogTitle>
        </DialogHeader>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onRename(label);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
