import { useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { newId, type ResumeContent, EXPERIENCE_LEVEL_LABEL, type ExperienceLevel } from "@/lib/madee-resume-types";
import { generateResumeSummary, improveResumeBullet, grammarCheckResume } from "@/lib/madee-ai.functions";
import { executeAction } from "@/lib/actions";

type Setter = (updater: (r: ResumeContent) => ResumeContent) => void;

/* ---------- Personal + summary ---------- */

export function PersonalSection({
  resume, setResume, profession, experienceLevel,
}: {
  resume: ResumeContent;
  setResume: Setter;
  profession: string | null;
  experienceLevel: ExperienceLevel | null;
}) {
  const genSummary = useServerFn(generateResumeSummary);
  const grammar = useServerFn(grammarCheckResume);
  const [busy, setBusy] = useState<null | "summary" | "grammar">(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            value={resume.personal.fullName}
            maxLength={160}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, fullName: e.target.value } }))
            }
          />
        </Field>
        <Field label="Headline (e.g. Senior Product Designer)">
          <Input
            value={resume.personal.headline}
            maxLength={200}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, headline: e.target.value } }))
            }
          />
        </Field>
        <Field label="Email">
          <Input
            value={resume.personal.email}
            maxLength={200}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, email: e.target.value } }))
            }
          />
        </Field>
        <Field label="Phone">
          <Input
            value={resume.personal.phone}
            maxLength={60}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, phone: e.target.value } }))
            }
          />
        </Field>
        <Field label="Location">
          <Input
            value={resume.personal.location}
            maxLength={200}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, location: e.target.value } }))
            }
          />
        </Field>
        <Field label="Website / portfolio">
          <Input
            value={resume.personal.website}
            maxLength={300}
            onChange={(e) =>
              setResume((r) => ({ ...r, personal: { ...r.personal, website: e.target.value } }))
            }
          />
        </Field>
      </div>

      <Field label="Professional summary">
        <Textarea
          value={resume.summary}
          maxLength={2000}
          rows={5}
          onChange={(e) => setResume((r) => ({ ...r, summary: e.target.value }))}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("summary");
            try {
              const res = await executeAction("madee.resume.ai_summary", {
                run: () =>
                  genSummary({
                    data: {
                      profession: profession ?? undefined,
                      experienceLevel: experienceLevel
                        ? EXPERIENCE_LEVEL_LABEL[experienceLevel]
                        : undefined,
                      skills: resume.skills.slice(0, 20),
                      highlights: resume.work
                        .flatMap((w) => [w.role, ...w.bullets])
                        .filter(Boolean)
                        .slice(0, 12)
                        .join("\n"),
                    },
                  }),
              });
              if (res.ok) setResume((r) => ({ ...r, summary: res.result }));
              else toast.error(res.error);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "AI request failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Draft summary
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null || !resume.summary.trim()}
          onClick={async () => {
            setBusy("grammar");
            try {
              const res = await executeAction("madee.resume.ai_grammar", {
                run: () => grammar({ data: { text: resume.summary } }),
              });
              if (res.ok) setResume((r) => ({ ...r, summary: res.result }));
              else toast.error(res.error);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "AI request failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "grammar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Grammar check
        </Button>
      </div>
    </div>
  );
}

/* ---------- Work ---------- */

export function WorkSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const improve = useServerFn(improveResumeBullet);
  const [busy, setBusy] = useState<string | null>(null);
  const add = () =>
    setResume((r) => ({
      ...r,
      work: [
        ...r.work,
        { id: newId(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: [""] },
      ],
    }));
  return (
    <div className="space-y-4">
      {resume.work.map((w, idx) => (
        <div key={w.id} className="rounded-lg border border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Role">
              <Input value={w.role} onChange={(e) => update(idx, { role: e.target.value })} />
            </Field>
            <Field label="Company">
              <Input value={w.company} onChange={(e) => update(idx, { company: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={w.location} onChange={(e) => update(idx, { location: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Field label="Start (YYYY-MM)">
                <Input value={w.start} maxLength={10} placeholder="2022-01" onChange={(e) => update(idx, { start: e.target.value })} />
              </Field>
              <Field label={w.current ? "Present" : "End (YYYY-MM)"}>
                <Input value={w.current ? "" : w.end} disabled={w.current} maxLength={10} placeholder="2024-03" onChange={(e) => update(idx, { end: e.target.value })} />
              </Field>
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={w.current}
              onChange={(e) => update(idx, { current: e.target.checked })}
            />
            I currently work here
          </label>
          <div className="mt-3 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bullets</Label>
            {w.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <Textarea
                  value={b}
                  rows={2}
                  maxLength={600}
                  onChange={(e) => updateBullet(idx, i, e.target.value)}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy !== null || !b.trim()}
                    onClick={async () => {
                      const key = `${w.id}:${i}`;
                      setBusy(key);
                      try {
                        const res = await executeAction("madee.resume.ai_bullet", {
                          run: () => improve({ data: { bullet: b, role: w.role, company: w.company } }),
                        });
                        if (res.ok) updateBullet(idx, i, res.result);
                        else toast.error(res.error);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "AI request failed");
                      } finally {
                        setBusy(null);
                      }
                    }}
                    title="Strengthen this bullet"
                  >
                    {busy === `${w.id}:${i}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      update(idx, {
                        bullets: w.bullets.filter((_, j) => j !== i),
                      })
                    }
                    title="Remove bullet"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => update(idx, { bullets: [...w.bullets, ""] })}
            >
              <Plus className="h-4 w-4" /> Add bullet
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setResume((r) => ({ ...r, work: r.work.filter((_, j) => j !== idx) }))}
            >
              <Trash2 className="h-4 w-4" /> Remove role
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add}>
        <Plus className="h-4 w-4" /> Add role
      </Button>
    </div>
  );

  function update(idx: number, patch: Partial<ResumeContent["work"][number]>) {
    setResume((r) => ({
      ...r,
      work: r.work.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    }));
  }
  function updateBullet(idx: number, i: number, value: string) {
    setResume((r) => ({
      ...r,
      work: r.work.map((w, wi) =>
        wi === idx ? { ...w, bullets: w.bullets.map((b, bi) => (bi === i ? value : b)) } : w,
      ),
    }));
  }
}

/* ---------- Education ---------- */

export function EducationSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const add = () =>
    setResume((r) => ({
      ...r,
      education: [
        ...r.education,
        { id: newId(), school: "", degree: "", field: "", location: "", start: "", end: "", notes: "" },
      ],
    }));
  return (
    <div className="space-y-3">
      {resume.education.map((e, idx) => (
        <div key={e.id} className="rounded-lg border border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="School"><Input value={e.school} onChange={(ev) => set(idx, { school: ev.target.value })} /></Field>
            <Field label="Degree"><Input value={e.degree} onChange={(ev) => set(idx, { degree: ev.target.value })} /></Field>
            <Field label="Field of study"><Input value={e.field} onChange={(ev) => set(idx, { field: ev.target.value })} /></Field>
            <Field label="Location"><Input value={e.location} onChange={(ev) => set(idx, { location: ev.target.value })} /></Field>
            <Field label="Start"><Input value={e.start} maxLength={10} placeholder="2018" onChange={(ev) => set(idx, { start: ev.target.value })} /></Field>
            <Field label="End"><Input value={e.end} maxLength={10} placeholder="2022" onChange={(ev) => set(idx, { end: ev.target.value })} /></Field>
          </div>
          <Field label="Notes / honours">
            <Textarea rows={2} value={e.notes} maxLength={600} onChange={(ev) => set(idx, { notes: ev.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setResume((r) => ({ ...r, education: r.education.filter((_, j) => j !== idx) }))}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add education</Button>
    </div>
  );
  function set(idx: number, patch: Partial<ResumeContent["education"][number]>) {
    setResume((r) => ({
      ...r,
      education: r.education.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  }
}

/* ---------- Simple list sections ---------- */

export function SkillsSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  return <StringListEditor
    label="Skill"
    values={resume.skills}
    onChange={(next) => setResume((r) => ({ ...r, skills: next }))}
  />;
}

export function AchievementsSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  return <StringListEditor
    label="Achievement"
    values={resume.achievements}
    onChange={(next) => setResume((r) => ({ ...r, achievements: next }))}
    multiline
  />;
}

/* ---------- Projects ---------- */

export function ProjectsSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const add = () =>
    setResume((r) => ({
      ...r,
      projects: [...r.projects, { id: newId(), name: "", role: "", link: "", bullets: [""] }],
    }));
  return (
    <div className="space-y-3">
      {resume.projects.map((p, idx) => (
        <div key={p.id} className="rounded-lg border border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name"><Input value={p.name} onChange={(e) => set(idx, { name: e.target.value })} /></Field>
            <Field label="Role"><Input value={p.role} onChange={(e) => set(idx, { role: e.target.value })} /></Field>
          </div>
          <Field label="Link"><Input value={p.link} onChange={(e) => set(idx, { link: e.target.value })} /></Field>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bullets</Label>
          {p.bullets.map((b, i) => (
            <div key={i} className="mt-1 flex gap-2">
              <Textarea rows={2} value={b} maxLength={600} onChange={(e) => setB(idx, i, e.target.value)} />
              <Button size="icon" variant="ghost" onClick={() => set(idx, { bullets: p.bullets.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => set(idx, { bullets: [...p.bullets, ""] })}>
            <Plus className="h-4 w-4" /> Add bullet
          </Button>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setResume((r) => ({ ...r, projects: r.projects.filter((_, j) => j !== idx) }))}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add project</Button>
    </div>
  );
  function set(idx: number, patch: Partial<ResumeContent["projects"][number]>) {
    setResume((r) => ({
      ...r,
      projects: r.projects.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }
  function setB(idx: number, i: number, value: string) {
    setResume((r) => ({
      ...r,
      projects: r.projects.map((p, pi) =>
        pi === idx ? { ...p, bullets: p.bullets.map((b, bi) => (bi === i ? value : b)) } : p,
      ),
    }));
  }
}

/* ---------- Certifications ---------- */

export function CertificationsSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const add = () =>
    setResume((r) => ({
      ...r,
      certifications: [...r.certifications, { id: newId(), name: "", issuer: "", date: "", id_number: "" }],
    }));
  return (
    <div className="space-y-3">
      {resume.certifications.map((c, idx) => (
        <div key={c.id} className="rounded-lg border border-border/60 p-3 grid gap-2 sm:grid-cols-2">
          <Field label="Name"><Input value={c.name} onChange={(e) => set(idx, { name: e.target.value })} /></Field>
          <Field label="Issuer"><Input value={c.issuer} onChange={(e) => set(idx, { issuer: e.target.value })} /></Field>
          <Field label="Date"><Input value={c.date} onChange={(e) => set(idx, { date: e.target.value })} /></Field>
          <Field label="Credential ID"><Input value={c.id_number} onChange={(e) => set(idx, { id_number: e.target.value })} /></Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setResume((r) => ({ ...r, certifications: r.certifications.filter((_, j) => j !== idx) }))}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add certification</Button>
    </div>
  );
  function set(idx: number, patch: Partial<ResumeContent["certifications"][number]>) {
    setResume((r) => ({
      ...r,
      certifications: r.certifications.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }
}

/* ---------- Languages ---------- */

export function LanguagesSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const add = () =>
    setResume((r) => ({
      ...r,
      languages: [...r.languages, { id: newId(), name: "", proficiency: "professional" }],
    }));
  return (
    <div className="space-y-3">
      {resume.languages.map((l, idx) => (
        <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 p-3">
          <Field label="Language" className="flex-1 min-w-[10rem]">
            <Input value={l.name} onChange={(e) => set(idx, { name: e.target.value })} />
          </Field>
          <Field label="Proficiency">
            <select
              value={l.proficiency}
              onChange={(e) => set(idx, { proficiency: e.target.value as ResumeContent["languages"][number]["proficiency"] })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="basic">basic</option>
              <option value="conversational">conversational</option>
              <option value="professional">professional</option>
              <option value="fluent">fluent</option>
              <option value="native">native</option>
            </select>
          </Field>
          <Button size="icon" variant="ghost" onClick={() => setResume((r) => ({ ...r, languages: r.languages.filter((_, j) => j !== idx) }))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add language</Button>
    </div>
  );
  function set(idx: number, patch: Partial<ResumeContent["languages"][number]>) {
    setResume((r) => ({
      ...r,
      languages: r.languages.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
}

/* ---------- Links ---------- */

export function LinksSection({ resume, setResume }: { resume: ResumeContent; setResume: Setter }) {
  const add = () =>
    setResume((r) => ({
      ...r,
      links: [...r.links, { id: newId(), label: "", url: "" }],
    }));
  return (
    <div className="space-y-3">
      {resume.links.map((l, idx) => (
        <div key={l.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end rounded-lg border border-border/60 p-3">
          <Field label="Label"><Input value={l.label} onChange={(e) => set(idx, { label: e.target.value })} /></Field>
          <Field label="URL"><Input value={l.url} onChange={(e) => set(idx, { url: e.target.value })} /></Field>
          <Button size="icon" variant="ghost" onClick={() => setResume((r) => ({ ...r, links: r.links.filter((_, j) => j !== idx) }))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add link</Button>
    </div>
  );
  function set(idx: number, patch: Partial<ResumeContent["links"][number]>) {
    setResume((r) => ({
      ...r,
      links: r.links.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
}

/* ---------- Primitives ---------- */

function Field({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StringListEditor({
  label, values, onChange, multiline,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          {multiline ? (
            <Textarea rows={2} value={v} maxLength={600} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          ) : (
            <Input value={v} maxLength={120} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <Button size="icon" variant="ghost" onClick={() => onChange(values.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...values, ""])}>
        <Plus className="h-4 w-4" /> Add {label.toLowerCase()}
      </Button>
    </div>
  );
}
