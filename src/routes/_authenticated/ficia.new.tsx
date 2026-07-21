import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Info, AlertTriangle, CheckCircle2, Loader2, Building2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  createCompany,
  checkLegalId,
  checkSimilarNames,
  requestCompanyAccess,
} from "@/lib/ficia-companies.functions";
import { executeAction } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/ficia/new")({
  head: () => ({
    meta: [
      { title: "New company — FICIA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewCompanyWizard,
});

type Branch = { label: string; address?: string; city?: string; region?: string; country?: string };
type Subsidiary = { name: string; country?: string; registration_number?: string; ownership_percent?: number };

type Form = {
  name: string;
  legal_name: string;
  entity_type: string;
  country: string;
  region: string;
  industry: string;
  currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  fiscal_year_end_month?: number;
  accounting_method?: "accrual" | "cash";
  registration_number: string;
  tax_ids: { gstin: string; pan: string; vat: string; ein: string };
  address: { line1: string; line2: string; city: string; region: string; postal_code: string };
  contact: { email: string; phone: string; website: string };
  description: string;
  branches: Branch[];
  subsidiaries: Subsidiary[];
  logo_url: string;
};

const COUNTRIES = [
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata", fyStart: 4, entityTypes: ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "OPC"] },
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York", fyStart: 1, entityTypes: ["Sole Proprietorship", "LLC", "S-Corp", "C-Corp", "Partnership"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London", fyStart: 4, entityTypes: ["Sole Trader", "Ltd", "PLC", "LLP"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai", fyStart: 1, entityTypes: ["Sole Establishment", "LLC", "PJSC"] },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore", fyStart: 1, entityTypes: ["Sole Proprietorship", "Pte Ltd", "LLP"] },
];

const INITIAL: Form = {
  name: "",
  legal_name: "",
  entity_type: "",
  country: "IN",
  region: "",
  industry: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
  fiscal_year_start_month: 4,
  registration_number: "",
  tax_ids: { gstin: "", pan: "", vat: "", ein: "" },
  address: { line1: "", line2: "", city: "", region: "", postal_code: "" },
  contact: { email: "", phone: "", website: "" },
  description: "",
  branches: [],
  subsidiaries: [],
  logo_url: "",
};

const STEPS = ["Basics", "Legal & tax", "Address & contact", "Branches", "Review"] as const;

function NewCompanyWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(INITIAL);
  const [similar, setSimilar] = useState<Array<{ id: string; name: string }>>([]);
  const [conflict, setConflict] = useState<{ id: string; name: string; matched: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const country = COUNTRIES.find((c) => c.code === f.country) ?? COUNTRIES[0];
  const isIndia = f.country === "IN";

  // Auto-apply country defaults when country changes
  function setCountry(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0];
    setF((prev) => ({
      ...prev,
      country: c.code,
      currency: c.currency,
      timezone: c.timezone,
      fiscal_year_start_month: c.fyStart,
    }));
    setConflict(null);
  }

  // Debounced similar-name check
  useEffect(() => {
    if (f.name.trim().length < 3) { setSimilar([]); return; }
    const h = setTimeout(async () => {
      try {
        const r = await checkSimilarNames({ data: { country: f.country, name: f.name.trim() } });
        setSimilar(r.ok ? r.matches : []);
      } catch { /* silent */ }
    }, 400);
    return () => clearTimeout(h);
  }, [f.name, f.country]);

  async function verifyLegalId(): Promise<boolean> {
    setConflict(null);
    if (!f.registration_number && !f.tax_ids.gstin && !f.tax_ids.pan) return true;
    const r = await checkLegalId({
      data: {
        country: f.country,
        registration_number: f.registration_number,
        gstin: f.tax_ids.gstin,
        pan: f.tax_ids.pan,
      },
    });
    if (r.ok && r.conflicts.length > 0) {
      setConflict(r.conflicts[0]);
      return false;
    }
    return true;
  }

  async function next() {
    setFlash(null);
    if (step === 0) {
      if (f.name.trim().length < 2) { setFlash("Display name is required."); return; }
    }
    if (step === 1) {
      const ok = await verifyLegalId();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setBusy(true);
    setFlash(null);
    try {
      const ok = await verifyLegalId();
      if (!ok) { setBusy(false); return; }

      const payload = {
        ...f,
        legal_name: f.legal_name || undefined,
        entity_type: f.entity_type || undefined,
        industry: f.industry || undefined,
        region: f.region || undefined,
        description: f.description || undefined,
        logo_url: f.logo_url || undefined,
        kind: "company" as const,
        tax_ids: Object.fromEntries(Object.entries(f.tax_ids).filter(([, v]) => v)),
      };

      const res = await executeAction("ficia.company.create", {
        confirmed: true,
        run: () => createCompany({ data: payload as any }),
      });

      if (res.ok) {
        navigate({ to: "/ficia/$tenantId", params: { tenantId: res.id } });
      } else if (res.code === "duplicate_legal_id" && res.conflict_id) {
        setConflict({ id: res.conflict_id, name: "an existing company", matched: "legal id" });
        setStep(1);
      } else {
        setFlash(res.message);
      }
    } catch (e) {
      setFlash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestAccessFor(tenantId: string) {
    setBusy(true);
    setFlash(null);
    try {
      const r = await requestCompanyAccess({
        data: {
          tenant_id: tenantId,
          requested_role: "employee",
          message: `Requesting access after attempting to create ${f.name}.`,
        },
      });
      setFlash(r.ok ? "Access request sent to the current owner." : r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/ficia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All companies
        </Link>
      </div>

      <PageHeader
        eyebrow="FICIA — new company"
        title="Create a company"
        description="Beginner-friendly setup. Everything you enter stays inside this company workspace."
      />

      <GlassPanel className="p-3 mt-4 mb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`px-2.5 py-1 rounded-full border ${i === step ? "border-primary bg-primary/10" : i < step ? "border-success/40 text-success" : "border-border text-muted-foreground"}`}
            >
              {i + 1}. {s} {i < step && <CheckCircle2 className="inline size-3" />}
            </div>
          ))}
        </div>
      </GlassPanel>

      {flash && (
        <GlassPanel className="p-3 mb-4 text-sm">{flash}</GlassPanel>
      )}

      {step === 0 && (
        <GlassPanel className="p-5 grid gap-4">
          <Explain>The display name is what you see everywhere. The legal name goes on official documents.</Explain>
          <div className="grid gap-2">
            <Label>Display name *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ashwin Consultancy" />
            {similar.length > 0 && (
              <p className="text-xs text-warning flex items-start gap-2">
                <AlertTriangle className="size-3 mt-0.5" />
                Similar names in {country.name}: {similar.map((s) => s.name).join(", ")}. This is a warning only.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Legal name</Label>
            <Input value={f.legal_name} onChange={(e) => setF({ ...f, legal_name: e.target.value })} placeholder="e.g. Ashwin Consultancy LLP" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Country *</Label>
              <select
                value={f.country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Entity type</Label>
              <select
                value={f.entity_type}
                onChange={(e) => setF({ ...f, entity_type: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">Select…</option>
                {country.entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Industry</Label>
              <Input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} placeholder="e.g. Consulting" />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} maxLength={3} />
            </div>
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Fiscal year start month</Label>
              <Input type="number" min={1} max={12} value={f.fiscal_year_start_month} onChange={(e) => setF({ ...f, fiscal_year_start_month: Number(e.target.value) })} />
            </div>
          </div>
        </GlassPanel>
      )}

      {step === 1 && (
        <GlassPanel className="p-5 grid gap-4">
          <Explain>Official IDs are checked against every existing company in the same country. If a match exists, you'll be offered a safe access request instead of creating a duplicate.</Explain>
          <div className="grid gap-2">
            <Label>Official registration number</Label>
            <Input value={f.registration_number} onChange={(e) => setF({ ...f, registration_number: e.target.value })} placeholder={isIndia ? "e.g. CIN / LLPIN" : "Company / EIN / VAT number"} />
          </div>
          {isIndia && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>GSTIN</Label>
                <Input value={f.tax_ids.gstin} onChange={(e) => setF({ ...f, tax_ids: { ...f.tax_ids, gstin: e.target.value.toUpperCase() } })} maxLength={20} />
              </div>
              <div className="grid gap-2">
                <Label>PAN</Label>
                <Input value={f.tax_ids.pan} onChange={(e) => setF({ ...f, tax_ids: { ...f.tax_ids, pan: e.target.value.toUpperCase() } })} maxLength={10} />
              </div>
            </div>
          )}
          {!isIndia && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>VAT / GST</Label>
                <Input value={f.tax_ids.vat} onChange={(e) => setF({ ...f, tax_ids: { ...f.tax_ids, vat: e.target.value } })} />
              </div>
              <div className="grid gap-2">
                <Label>EIN / TIN</Label>
                <Input value={f.tax_ids.ein} onChange={(e) => setF({ ...f, tax_ids: { ...f.tax_ids, ein: e.target.value } })} />
              </div>
            </div>
          )}
          {conflict && (
            <GlassPanel className="p-3 border-warning/40 bg-warning/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    A company with this <b>{conflict.matched.replace("_", " ")}</b> already exists in {country.name}.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If this is your company, request access instead of creating a duplicate.
                    Only the current owner can approve.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => requestAccessFor(conflict.id)} disabled={busy}>
                      Request access
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConflict(null)}>Change my ID</Button>
                  </div>
                </div>
              </div>
            </GlassPanel>
          )}
        </GlassPanel>
      )}

      {step === 2 && (
        <GlassPanel className="p-5 grid gap-4">
          <Explain>Address goes on invoices and filings. Contact details are what customers and auditors will see.</Explain>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2"><Label>Address line 1</Label><Input value={f.address.line1} onChange={(e) => setF({ ...f, address: { ...f.address, line1: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>Address line 2</Label><Input value={f.address.line2} onChange={(e) => setF({ ...f, address: { ...f.address, line2: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>City</Label><Input value={f.address.city} onChange={(e) => setF({ ...f, address: { ...f.address, city: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>State / region</Label><Input value={f.address.region} onChange={(e) => setF({ ...f, address: { ...f.address, region: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>Postal code</Label><Input value={f.address.postal_code} onChange={(e) => setF({ ...f, address: { ...f.address, postal_code: e.target.value } })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={f.contact.email} onChange={(e) => setF({ ...f, contact: { ...f.contact, email: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>Phone</Label><Input value={f.contact.phone} onChange={(e) => setF({ ...f, contact: { ...f.contact, phone: e.target.value } })} /></div>
            <div className="grid gap-2"><Label>Website</Label><Input type="url" value={f.contact.website} onChange={(e) => setF({ ...f, contact: { ...f.contact, website: e.target.value } })} /></div>
          </div>
          <div className="grid gap-2">
            <Label>Logo URL</Label>
            <Input type="url" value={f.logo_url} onChange={(e) => setF({ ...f, logo_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
        </GlassPanel>
      )}

      {step === 3 && (
        <GlassPanel className="p-5 grid gap-4">
          <Explain>Optional. Add branches (offices, stores) and subsidiaries (legally separate entities you own).</Explain>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Branches</h4>
              <Button size="sm" variant="outline" onClick={() => setF({ ...f, branches: [...f.branches, { label: "" }] })}>
                <Plus className="size-3" /> Add branch
              </Button>
            </div>
            <div className="grid gap-2">
              {f.branches.map((b, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-4 items-center border border-border rounded-md p-2">
                  <Input placeholder="Label" value={b.label} onChange={(e) => update("branches", i, { ...b, label: e.target.value })} />
                  <Input placeholder="City" value={b.city ?? ""} onChange={(e) => update("branches", i, { ...b, city: e.target.value })} />
                  <Input placeholder="Country (ISO-2)" maxLength={2} value={b.country ?? ""} onChange={(e) => update("branches", i, { ...b, country: e.target.value.toUpperCase() })} />
                  <Button size="sm" variant="ghost" onClick={() => remove("branches", i)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
              {f.branches.length === 0 && <p className="text-xs text-muted-foreground">No branches added.</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Subsidiaries</h4>
              <Button size="sm" variant="outline" onClick={() => setF({ ...f, subsidiaries: [...f.subsidiaries, { name: "" }] })}>
                <Plus className="size-3" /> Add subsidiary
              </Button>
            </div>
            <div className="grid gap-2">
              {f.subsidiaries.map((s, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-4 items-center border border-border rounded-md p-2">
                  <Input placeholder="Name" value={s.name} onChange={(e) => update("subsidiaries", i, { ...s, name: e.target.value })} />
                  <Input placeholder="Country (ISO-2)" maxLength={2} value={s.country ?? ""} onChange={(e) => update("subsidiaries", i, { ...s, country: e.target.value.toUpperCase() })} />
                  <Input placeholder="Ownership %" type="number" min={0} max={100} value={s.ownership_percent ?? ""} onChange={(e) => update("subsidiaries", i, { ...s, ownership_percent: Number(e.target.value) })} />
                  <Button size="sm" variant="ghost" onClick={() => remove("subsidiaries", i)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
              {f.subsidiaries.length === 0 && <p className="text-xs text-muted-foreground">No subsidiaries added.</p>}
            </div>
          </div>
        </GlassPanel>
      )}

      {step === 4 && (
        <GlassPanel className="p-5 grid gap-3">
          <Explain>Review carefully. On create, you become the owner. Duplicate legal IDs are blocked.</Explain>
          <ReviewRow label="Display name" value={f.name} />
          <ReviewRow label="Legal name" value={f.legal_name || "—"} />
          <ReviewRow label="Country" value={`${country.name} (${f.country})`} />
          <ReviewRow label="Entity type" value={f.entity_type || "—"} />
          <ReviewRow label="Currency / TZ" value={`${f.currency} · ${f.timezone}`} />
          <ReviewRow label="Fiscal year start" value={`Month ${f.fiscal_year_start_month}`} />
          <ReviewRow label="Registration number" value={f.registration_number || "—"} />
          {isIndia && <ReviewRow label="GSTIN" value={f.tax_ids.gstin || "—"} />}
          {isIndia && <ReviewRow label="PAN" value={f.tax_ids.pan || "—"} />}
          {!isIndia && <ReviewRow label="Tax IDs" value={[f.tax_ids.vat, f.tax_ids.ein].filter(Boolean).join(" · ") || "—"} />}
          <ReviewRow label="Branches" value={f.branches.length + " added"} />
          <ReviewRow label="Subsidiaries" value={f.subsidiaries.length + " added"} />
          {conflict && (
            <p className="text-sm text-warning">Duplicate legal ID detected — please resolve in step 2.</p>
          )}
        </GlassPanel>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={busy}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={busy || !!conflict}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
            <span className="ml-1">Create company</span>
          </Button>
        )}
      </div>
    </AppShell>
  );

  function update<K extends "branches" | "subsidiaries">(key: K, i: number, v: any) {
    setF((prev) => {
      const arr = [...(prev[key] as any[])];
      arr[i] = v;
      return { ...prev, [key]: arr } as Form;
    });
  }
  function remove<K extends "branches" | "subsidiaries">(key: K, i: number) {
    setF((prev) => ({ ...prev, [key]: (prev[key] as any[]).filter((_, j) => j !== i) } as Form));
  }
}

function Explain({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-md bg-muted/30">
      <Info className="size-3 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 font-medium">{value}</span>
    </div>
  );
}
