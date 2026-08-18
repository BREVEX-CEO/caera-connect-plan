import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Cpu, Gauge, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { LocalModelLifecyclePanel } from "@/components/ocade/LocalModelLifecyclePanel";
import { LocalEngineControl } from "@/components/ocade/LocalEngineControl";
import { FIXED_MODEL } from "@/lib/local/fixed-model";
import { WEBGPU_TIERS, WASM_TIERS, formatSize } from "@/lib/brain/browser-catalogue";

export const Route = createFileRoute("/_authenticated/ocade/models")({
  head: () => ({ meta: [{ title: "OCADE Local Engines — CAERA CADANE" }, { name: "robots", content: "noindex" }] }),
  component: OcadeModelsPage,
});

function OcadeModelsPage() {
  return (
    <AppShell>
      <PageHeader
        title="OCADE Local Engines"
        description="Every AI model shown here runs on this device. There is no Gemini, GPT/OpenAI, Lovable, or other public cloud-model route."
        actions={<Link to="/ocade" className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Back to chat</Link>}
      />
      <div className="mx-auto grid max-w-5xl gap-5 pb-16">
        <GlassPanel className="p-5">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[color:var(--state-success)]" /><div><h2 className="text-sm font-semibold">Local-only architecture</h2><p className="mt-1 text-sm text-muted-foreground">If no local engine can serve a request, OCADE reports that clearly and offers local setup/retry actions. It never falls back to a public AI provider.</p></div></div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="mb-3 flex items-center gap-2"><Cpu className="h-4 w-4" /><h2 className="text-sm font-semibold">Desktop local engine</h2></div>
          <div className="grid gap-3 sm:grid-cols-3"><Fact label="Weights" value={`${FIXED_MODEL.family} ${FIXED_MODEL.parameters}`} /><Fact label="Quantization" value={FIXED_MODEL.quantisation} /><Fact label="Approx. size" value={formatSize(FIXED_MODEL.approxBytes)} /></div>
          <p className="mt-3 text-xs text-muted-foreground">Interrupted local-model pulls retry automatically up to five attempts. Completed runtime blobs are reused so transient failures resume rather than deliberately discarding progress.</p>
          <div className="mt-5 border-t border-border/60 pt-5"><LocalEngineControl /><div className="mt-5" /><LocalModelLifecyclePanel /></div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="mb-2 flex items-center gap-2"><Gauge className="h-4 w-4" /><h2 className="text-sm font-semibold">Browser-local engine</h2></div>
          <p className="mb-4 text-sm text-muted-foreground">WebGPU is preferred and model data stays in IndexedDB. Every device starts on the smallest tier; the larger tier is promoted only after this device has completed a real generation within the performance ceiling. WASM is the CPU compatibility fallback.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {WEBGPU_TIERS.map((tier, index) => <Tier key={tier.label} title={tier.label} note={index === 0 ? "WebGPU default" : "Promotion requires measured proof"} size={formatSize(tier.downloadBytes)} />)}
            {WASM_TIERS.map((tier) => <Tier key={tier.label} title={tier.label} note="CPU / WASM fallback" size={formatSize(tier.downloadBytes)} />)}
          </div>
          <p className="mt-4 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Multiple tabs:</strong> Web Locks elect one same-origin model owner. Other tabs relay requests and tokens through BroadcastChannel instead of loading another model copy. Browsers missing those coordination primitives are refused rather than allowed to duplicate the engine.</p>
        </GlassPanel>
      </div>
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/60 bg-card/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
function Tier({ title, note, size }: { title: string; note: string; size: string }) {
  return <div className="rounded-lg border border-border/60 bg-card/40 p-4"><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{note}</p><p className="mt-3 text-xs">Download: {size}</p></div>;
}
