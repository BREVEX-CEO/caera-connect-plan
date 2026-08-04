import { Megaphone } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";

const stages = [
  ["AZ-429", "Signing"],
  ["AZ-430", "Deployment"],
  ["AZ-431", "Support readiness"],
  ["AZ-432", "Announcement"],
] as const;

export function LaunchAuthorityBoundary() {
  return (
    <GlassPanel className="mt-6 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="h-4 w-4" aria-hidden /> Production launch authority
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These stages are dependency ordered. Announcement remains impossible until trusted signing,
        independently observed deployment and rollback, staffed support drills, and final readiness
        all pass.
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {stages.map(([id, label], index) => (
          <li key={id} className="rounded-md border border-border/50 p-2 text-xs">
            <span className="text-muted-foreground">
              {index + 1}. {id}
            </span>
            <div className="font-medium">{label}</div>
            <div className="mt-1 text-[10px] text-[color:var(--state-warning)]">
              Externally blocked
            </div>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}
