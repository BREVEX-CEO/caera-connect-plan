import { useState } from "react";
import { BadgeCheck, CircleDollarSign, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { MARKETPLACE_RUNTIME_BOUNDARY } from "@/lib/skills/marketplace";

export function MarketplaceBoundaryPanel() {
  const [checked, setChecked] = useState(false);

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Store className="h-4 w-4" aria-hidden /> Community compatibility
      </h3>
      <p className="text-xs text-muted-foreground">
        Signed skills can be reviewed, sandboxed, version-bound, revalidated locally and revoked.
        This installation does not publish them to a hosted marketplace.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <BadgeCheck className="h-4 w-4 text-[color:var(--state-success)]" aria-hidden />
            Local review available
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Signatures, reputation, permissions, exact app version and acceptance evidence are
            checked before installation.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" aria-hidden />
            Payouts externally blocked
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Requests use priority credits only. Money cannot move until compliant payments and
            contributor identity checks exist.
          </p>
        </div>
      </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => setChecked(true)}>
        Check marketplace boundary
      </Button>
      {checked ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Mode: {MARKETPLACE_RUNTIME_BOUNDARY.mode}. Local admission never proves that the target
          application ran here.
        </p>
      ) : null}
    </GlassPanel>
  );
}
