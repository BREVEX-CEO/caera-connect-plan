import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createResumeProject, createResumeVersion } from "@/lib/madee.functions";
import { parseUploadedResume } from "@/lib/madee-ai.functions";
import { executeAction } from "@/lib/actions";
import {
  EXPERIENCE_LEVEL_LABEL, ResumeContent, emptyResume, type ExperienceLevel,
} from "@/lib/madee-resume-types";
import { saveLocalResumeContent } from "@/lib/madee-local-store";

const ATTESTATION_TEXT =
  "I confirm I am the person this resume represents (or I am authorised to prepare it), " +
  "the facts I enter are accurate to the best of my knowledge, and I will not resell this " +
  "project or use it to misrepresent someone else's work history.";

export const Route = createFileRoute("/_authenticated/madee/new")({
  head: () => ({ meta: [{ title: "New resume — MADEE" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s) => z.object({ upload: z.coerce.number().optional() }).parse(s),
  component: NewResume,
});

function NewResume() {
  const nav = useNavigate();
  const create = useServerFn(createResumeProject);
  const createVer = useServerFn(createResumeVersion);
  const parse = useServerFn(parseUploadedResume);
  const search = Route.useSearch();

  const [title, setTitle] = useState("Untitled resume");
  const [profession, setProfession] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("mid");
  const [storageMode, setStorageMode] = useState<"browser_only" | "private_sync">("private_sync");
  const [targetRole, setTargetRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadedContent, setUploadedContent] = useState<ResumeContent | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    setUploading(true);
    try {
      let text = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        text = await file.text();
      } else {
        // For PDF/DOCX we fall back to plain-text extraction the browser
        // gives us. Users get a truthful hint if that produces nothing usable.
        text = await file.text().catch(() => "");
      }
      if (!text.trim() || text.length < 40) {
        toast.error(
          "Could not read enough text from that file in the browser. Paste the resume text into the field below, or start blank.",
        );
        return;
      }
      const res = await executeAction("madee.resume.upload_parse", {
        run: () => parse({ data: { text: text.slice(0, 18000) } }),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const parsed = ResumeContent.safeParse(res.result);
      if (!parsed.success) {
        toast.error("AI response didn't match resume shape. Try again or edit manually.");
        return;
      }
      setUploadedContent(parsed.data);
      if (!title || title === "Untitled resume") {
        setTitle(parsed.data.personal.fullName || "Uploaded resume");
      }
      if (!fullName) setFullName(parsed.data.personal.fullName);
      toast.success("Resume parsed. Review and save when ready.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit() {
    if (!accepted || fullName.trim().length < 2) {
      toast.error("Enter your name and accept the attestation to continue.");
      return;
    }
    setBusy(true);
    try {
      const proj = await executeAction("madee.resume.create", {
        run: () =>
          create({
            data: {
              title: title.trim() || "Untitled resume",
              profession: profession.trim() || null,
              experienceLevel,
              storageMode,
              attestationFullName: fullName.trim(),
              attestationText: ATTESTATION_TEXT,
              targetRole: targetRole.trim() || null,
            },
          }),
      });

      // Seed the first version with either uploaded content or an empty template.
      const initial = uploadedContent ?? emptyResume();
      const local = storageMode === "browser_only";
      const version = await executeAction("madee.resume.save_version", {
        run: () =>
          createVer({
            data: {
              projectId: proj.id,
              label: uploadedContent ? "Imported" : "Initial draft",
              content: local ? undefined : initial,
              contentStoredLocally: local,
              setAsCurrent: true,
            },
          }),
      });
      if (local) await saveLocalResumeContent(version.id, initial);

      toast.success("Resume created");
      nav({ to: "/madee/$projectId", params: { projectId: proj.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create resume");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="MADEE"
        title={search.upload ? "Upload a resume" : "New resume"}
        description="Set up the project. You can change any of this later, and edit as many versions as you need."
      />
      <div className="mx-auto mt-6 max-w-2xl space-y-6">
        {search.upload && (
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Upload file</Label>
            <p className="mb-2 text-sm text-muted-foreground">
              Supported: .txt, .md, or plain-text-extractable PDF/DOCX in this browser.
              Complex formatted PDFs may need you to paste the text.
            </p>
            <Input
              type="file"
              accept=".txt,.md,.pdf,.docx,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
              }}
              disabled={uploading}
            />
            {uploading && (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
              </p>
            )}
            {uploadedContent && (
              <p className="mt-2 text-sm text-emerald-500">
                Parsed. {uploadedContent.work.length} role(s), {uploadedContent.skills.length} skill(s).
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Project title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-1">
              <Label>Profession</Label>
              <Input
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                maxLength={160}
                placeholder="e.g. Product designer"
              />
            </div>
            <div className="space-y-1">
              <Label>Experience level</Label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {Object.entries(EXPERIENCE_LEVEL_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Target role (optional)</Label>
              <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={200} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Where should this resume live?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <StorageOption
                selected={storageMode === "private_sync"}
                onSelect={() => setStorageMode("private_sync")}
                title="Private Sync"
                description="Encrypted at rest in your account. Available on approved devices. Recommended."
              />
              <StorageOption
                selected={storageMode === "browser_only"}
                onSelect={() => setStorageMode("browser_only")}
                title="Browser Only"
                description="Content stays in this browser's encrypted vault. Cross-device sync off; export before clearing site data."
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[color:var(--accent-madee)]" />
            <div>
              <h3 className="font-semibold">Owner attestation</h3>
              <p className="text-sm text-muted-foreground">
                MADEE lets one person edit their own resume freely. To prevent resale
                and impersonation, we ask you to attest before saving.
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Your full legal name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} />
          </div>
          <Textarea readOnly rows={4} value={ATTESTATION_TEXT} className="text-xs" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            I have read and accept the attestation.
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => nav({ to: "/madee" })}>Cancel</Button>
          <Button disabled={busy || !accepted || fullName.trim().length < 2} onClick={onSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {search.upload ? "Save uploaded resume" : "Create resume"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function StorageOption({
  selected, onSelect, title, description,
}: { selected: boolean; onSelect: () => void; title: string; description: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-[color:var(--accent-madee)] bg-[color:var(--accent-madee)]/5" : "border-border/60 hover:border-border"
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
