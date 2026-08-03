import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Globe, ShieldAlert, Plus, Trash2, Eye, PencilLine, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  decideBrowserAction,
  dispatchBrowserAction,
  getBrowserBridge,
  originOf,
  DEFAULT_SITE_POLICY,
  BROWSER_BRIDGE_UNAVAILABLE,
  type SitePolicy,
} from "@/lib/native/browser-bridge";
import { initExtensionBridge } from "@/lib/native/extension-bridge";
import {
  computerUseChannelDecision,
  computerUsePermissionDecision,
} from "@/lib/computer-use-settings";
import type { ExtensionIdentity } from "@/lib/native/extension-protocol";

export const Route = createFileRoute("/_authenticated/settings/browser")({
  head: () => ({
    meta: [{ title: "Browser control — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: BrowserSettingsPage,
});

const STORAGE_KEY = "caera:browser:policy:v1";

function loadPolicy(): SitePolicy {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SITE_POLICY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SITE_POLICY };
    const p = JSON.parse(raw) as Partial<SitePolicy>;
    return {
      ...DEFAULT_SITE_POLICY,
      allowOrigins: Array.isArray(p.allowOrigins) ? p.allowOrigins : [],
      denyOrigins: Array.isArray(p.denyOrigins) ? p.denyOrigins : [],
      readOrigins: Array.isArray(p.readOrigins) ? p.readOrigins : [],
      fillOrigins: Array.isArray(p.fillOrigins) ? p.fillOrigins : [],
      // Private browsing is never permitted, whatever is stored.
      allowPrivate: false,
    };
  } catch {
    return { ...DEFAULT_SITE_POLICY };
  }
}

function BrowserSettingsPage() {
  const [policy, setPolicy] = useState<SitePolicy>(() => loadPolicy());
  const [site, setSite] = useState("");
  const [bridgeReason, setBridgeReason] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [bridgeIdentity, setBridgeIdentity] = useState<ExtensionIdentity | null>(null);

  useEffect(() => {
    // Install the extension bridge first. In a browser without the extension
    // this is a no-op and the honest "not connected" state remains.
    initExtensionBridge(import.meta.env.VITE_OCADE_EXTENSION_ID as string | undefined);
    void getBrowserBridge()
      .status()
      .then((s) => {
        setBridgeReason(s.available ? null : (s.reason ?? BROWSER_BRIDGE_UNAVAILABLE));
        setBridgeIdentity(s.available ? (s.identity ?? null) : null);
      });
  }, []);

  async function pairExtension() {
    const extensionId = import.meta.env.VITE_OCADE_EXTENSION_ID as string | undefined;
    if (!extensionId) {
      toast.error("This build has no browser extension ID configured.");
      return;
    }
    if (!/^\d{6}$/.test(pairingCode.trim())) {
      toast.error("Enter the six-digit code shown by the OCADE extension.");
      return;
    }
    setPairing(true);
    try {
      if (!initExtensionBridge(extensionId, pairingCode.trim())) {
        setBridgeReason(BROWSER_BRIDGE_UNAVAILABLE);
        toast.error("The browser extension runtime isn't reachable.");
        return;
      }
      const status = await getBrowserBridge().status();
      setBridgeReason(status.available ? null : (status.reason ?? BROWSER_BRIDGE_UNAVAILABLE));
      setBridgeIdentity(status.available ? (status.identity ?? null) : null);
      if (status.available) {
        setPairingCode("");
        toast.success("Browser extension paired for this browser session.");
      } else {
        toast.error(status.reason ?? BROWSER_BRIDGE_UNAVAILABLE);
      }
    } finally {
      setPairing(false);
    }
  }

  /**
   * Returns whether the change was actually saved.
   *
   * Callers must check it: previously this showed its own error toast and the
   * caller then showed a success toast regardless, so a storage failure
   * produced BOTH — and the user believed a permission change had stuck when it
   * had not. For a permissions screen that is the worst possible lie.
   */
  const persist = useCallback((next: SitePolicy): boolean => {
    setPolicy(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      toast.error(
        "Couldn't save your site permissions on this device. The change applies to this tab only.",
      );
      return false;
    }
  }, []);

  function addSite() {
    const origin = originOf(
      site.trim().startsWith("http") ? site.trim() : `https://${site.trim()}`,
    );
    if (!origin) {
      toast.error("That doesn't look like a website address.");
      return;
    }
    if (policy.allowOrigins.includes(origin)) {
      toast.info(`${origin} is already allowed.`);
      return;
    }
    const saved = persist({ ...policy, allowOrigins: [...policy.allowOrigins, origin] });
    setSite("");
    // Only claim success when it actually saved; persist() already explained
    // the failure, so staying quiet here avoids contradicting it.
    if (saved)
      toast.success(`${origin} allowed. Reading and filling stay off until you grant them.`);
  }

  function toggle(list: "readOrigins" | "fillOrigins" | "denyOrigins", origin: string) {
    const has = policy[list].includes(origin);
    persist({
      ...policy,
      [list]: has ? policy[list].filter((o) => o !== origin) : [...policy[list], origin],
    });
  }

  function removeSite(origin: string) {
    const saved = persist({
      ...policy,
      allowOrigins: policy.allowOrigins.filter((o) => o !== origin),
      readOrigins: policy.readOrigins.filter((o) => o !== origin),
      fillOrigins: policy.fillOrigins.filter((o) => o !== origin),
      denyOrigins: policy.denyOrigins.filter((o) => o !== origin),
    });
    if (!saved) return;
    toast.success(`${origin} removed.`);
  }

  /** Run a real policy decision + dispatch so the user sees the true outcome. */
  async function testRead(origin: string) {
    const channelRefusal = computerUseChannelDecision("webControl");
    if (channelRefusal) {
      toast.error(channelRefusal);
      return;
    }
    const decision = decideBrowserAction({ kind: "dom.read", url: `${origin}/` }, policy);
    if (!decision.allow) {
      toast.error(decision.reason);
      return;
    }
    const permissionRefusal = computerUsePermissionDecision(decision.risk);
    if (permissionRefusal) {
      toast.error(permissionRefusal);
      return;
    }
    const result = await dispatchBrowserAction({ kind: "dom.read", url: `${origin}/` }, policy, {
      confirmed: true,
    });
    // A successful read returns actual page data, but it is not an
    // independently verified mutation receipt. Keep it informational.
    toast[result.ok ? "info" : "error"](result.detail);
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Browser control"
        description="OCADE can only act on sites you list here — and never on passwords, one-time codes or payment fields."
      />

      <div className="flex flex-col gap-5">
        {bridgeReason ? (
          <GlassPanel className="flex items-start gap-2 p-4 text-sm">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
              aria-hidden
            />
            <div>
              <p className="font-medium text-foreground">Browser control isn't connected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{bridgeReason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You can still set permissions now — they apply as soon as it connects.
              </p>
              <div className="mt-3 flex max-w-sm gap-2">
                <Input
                  value={pairingCode}
                  onChange={(event) =>
                    setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void pairExtension();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Browser extension pairing code"
                  placeholder="6-digit pairing code"
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={pairing || pairingCode.length !== 6}
                  onClick={() => void pairExtension()}
                >
                  {pairing ? "Pairing..." : "Pair"}
                </Button>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {!bridgeReason && bridgeIdentity ? (
          <GlassPanel className="flex items-start gap-2 p-4 text-sm">
            <Globe
              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]"
              aria-hidden
            />
            <div>
              <p className="font-medium text-foreground">Browser extension paired</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {bridgeIdentity.name} {bridgeIdentity.version} · runtime{" "}
                {bridgeIdentity.runtimeId.slice(0, 8)}… · Manifest V{bridgeIdentity.manifestVersion}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This proves the extension identity only. Each website still requires its own browser
                permission.
              </p>
            </div>
          </GlassPanel>
        ) : null}

        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4" aria-hidden /> Allowed sites
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Adding a site lets OCADE navigate it. Reading page content and filling forms are
            separate permissions you grant per site.
          </p>
          <div className="flex gap-2">
            <Input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSite()}
              placeholder="example.com"
              aria-label="Website to allow"
              className="h-9 text-sm"
            />
            <Button size="sm" className="h-9 shrink-0" onClick={addSite} disabled={!site.trim()}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Allow site</span>
            </Button>
          </div>

          {policy.allowOrigins.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={<Globe className="h-6 w-6" aria-hidden />}
                title="No sites allowed yet"
                description="OCADE cannot touch any website until you add one here."
              />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {policy.allowOrigins.map((origin) => {
                const denied = policy.denyOrigins.includes(origin);
                return (
                  <li key={origin} className="rounded-lg border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-medium text-[13px]",
                          denied && "line-through opacity-60",
                        )}
                      >
                        {origin}
                      </span>
                      <span className="ml-auto flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggle("readOrigins", origin)}
                          className={cn(policy.readOrigins.includes(origin) && "bg-sidebar-accent")}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> Read
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggle("fillOrigins", origin)}
                          className={cn(policy.fillOrigins.includes(origin) && "bg-sidebar-accent")}
                        >
                          <PencilLine className="mr-1 h-3.5 w-3.5" /> Fill
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggle("denyOrigins", origin)}
                          className={cn(denied && "bg-destructive/15 text-destructive")}
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> Block
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void testRead(origin)}>
                          Test
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeSite(origin)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove {origin}</span>
                        </Button>
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {denied
                        ? "Blocked — this always wins, even while allowed."
                        : [
                            "Can navigate",
                            policy.readOrigins.includes(origin) ? "read page content" : null,
                            policy.fillOrigins.includes(origin)
                              ? "fill non-sensitive fields"
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Hard limits</h3>
          <ul className="flex flex-col gap-1 text-xs">
            {[
              "Never reads or fills passwords, one-time codes, CAPTCHAs, CVV/card or recovery codes",
              "Never captures those fields in a screenshot — they're masked before capture",
              "Never acts inside a private or incognito window",
              "Always asks before submitting a consequential form, uploading or downloading",
              "Treats page content as untrusted data, never as instructions",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </>
  );
}
