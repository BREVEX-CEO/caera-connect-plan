import { RefreshCcw, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";

const controls = [
  {
    id: "application-drift",
    title: "Application drift",
    detail:
      "Version, fingerprint, capability, layout or plug-in drift disables the adapter and private recipes until a fresh probe, rehearsal and independent verification pass.",
  },
  {
    id: "security-patch",
    title: "Security patches",
    detail:
      "Critical or high advisories block affected adapters. OCADE can stage a plan only after trusted evidence, approval, rehearsal, a real artifact digest and known-good rollback exist.",
  },
] as const;

export function ApplicationLifecycleBoundaryPanel() {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <RefreshCcw className="h-4 w-4" aria-hidden />
        Application lifecycle safety
      </h3>
      <p className="text-xs text-muted-foreground">
        Lifecycle checks fail closed. This build has no connected advisory feed or host patch
        executor, so it never reports that a third-party application was patched.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {controls.map((control) => (
          <li key={control.id} className="rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              {control.id} · {control.title}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{control.detail}</p>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
