import { useCallback, useEffect, useState } from "react";
import { Cloud, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "./SettingsGate";
import {
  listCloudConsent,
  revokeCloudConsent,
  revokeAllCloudConsent,
  type CloudConsentRecord,
} from "@/lib/engine/cloud-consent";
import { CLOUD_ALLOWANCE, CLOUD_WINDOW_MS } from "@/lib/payments/pricing";

/**
 * Which conversations may leave this device, and the ability to take it back.
 *
 * A permission you cannot review is not a permission. This lists every grant
 * with the date it was given and revokes any of them in one click — including
 * all at once, for the person who has changed their mind about the whole idea
 * and should not have to visit each conversation to say so.
 *
 * Local data about this device's willingness to send, so it is readable and
 * revocable WITHOUT an account: the read-only gate covers synced settings, and
 * a consent record the user cannot withdraw because they are signed out would
 * be the worst possible reading of "read-only".
 */
export function CloudPermissionPanel() {
  const [grants, setGrants] = useState<CloudConsentRecord[]>([]);

  const refresh = useCallback(() => setGrants(listCloudConsent()), []);
  useEffect(() => refresh(), [refresh]);

  const windowHours = Math.round(CLOUD_WINDOW_MS / 3_600_000);

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Cloud Permission</h3>
      </header>

      <ReadOnlyBanner />

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Conversations stored on this device never reach OCADE Cloud unless you allow it, and OCADE
        asks <span className="font-medium text-foreground">once per conversation</span> rather than
        once per message. Work that runs on your own hardware never asks and never counts against
        the {CLOUD_ALLOWANCE} cloud requests you get every {windowHours} hours.
      </p>

      {grants.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2.5 text-[12.5px] text-muted-foreground">
          No conversation on this device has been allowed to use OCADE Cloud.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {grants.map((grant) => (
              <li
                key={grant.conversationId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    <code className="font-mono text-[11px]">{grant.conversationId}</code>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Allowed {new Date(grant.grantedAt).toLocaleDateString()} at{" "}
                    {new Date(grant.grantedAt).toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Revoke cloud permission for this conversation"
                  onClick={() => {
                    revokeCloudConsent(grant.conversationId);
                    refresh();
                    toast.success("Revoked.", {
                      description: "OCADE will ask again before this conversation uses the cloud.",
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              revokeAllCloudConsent();
              refresh();
              toast.success("All cloud permissions revoked on this device.");
            }}
          >
            Revoke all
          </Button>
        </>
      )}

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        {/*
          Said plainly because it is the part people get wrong about consent
          stored locally, and the direction it fails in is the safe one.
        */}
        These permissions belong to this browser and are not synced, so a phone cannot grant cloud
        access on a laptop&apos;s behalf. Clearing browser data revokes them all.
      </p>
    </GlassPanel>
  );
}
