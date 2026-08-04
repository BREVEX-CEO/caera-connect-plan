import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Globe, Laptop, Plug, RefreshCw, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { getCompanion, subscribeCompanionAdapter } from "@/lib/native/companion-bridge";
import { getBrowserBridge } from "@/lib/native/browser-bridge";
import { initExtensionBridge } from "@/lib/native/extension-bridge";
import { activeDevices } from "@/lib/mobile/device-store";
import { getEmailConnectorStatus } from "@/lib/control/email-web-work";
import { cn } from "@/lib/utils";

type ConnectorState = {
  id: "native" | "browser" | "mobile" | "models" | "email_web";
  label: string;
  description: string;
  available: boolean;
  detail: string;
  to: string;
  action: string;
  icon: typeof Plug;
};

export function ConnectorsPanel() {
  const [rows, setRows] = useState<ConnectorState[]>([]);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    initExtensionBridge(import.meta.env.VITE_OCADE_EXTENSION_ID as string | undefined);
    const [native, browser, email] = await Promise.all([
      getCompanion().status(),
      getBrowserBridge().status(),
      getEmailConnectorStatus(),
    ]);
    const mobileCount = activeDevices().filter((device) => device.kind === "mobile").length;
    setRows([
      {
        id: "native",
        label: "CAERA Native Companion",
        description: "Signed local route for approved apps, windows, files and OS actions.",
        available: native.available,
        detail: native.available
          ? `Connected${native.version ? ` · version ${native.version}` : ""}`
          : (native.reason ?? "Native Companion is not connected."),
        to: "/settings/work",
        action: "Computer Use setup",
        icon: Laptop,
      },
      {
        id: "browser",
        label: "OCADE browser extension",
        description: "Per-site DOM and accessibility route with protected-field boundaries.",
        available: browser.available,
        detail: browser.available
          ? "Paired and reachable."
          : (browser.reason ?? "Browser extension is not paired."),
        to: "/settings/browser",
        action: "Browser permissions",
        icon: Globe,
      },
      {
        id: "mobile",
        label: "OCADE mobile companion",
        description: "Monitor, approve, pause, cancel and emergency-stop the same task.",
        available: mobileCount > 0,
        detail:
          mobileCount > 0
            ? `${mobileCount} active mobile ${mobileCount === 1 ? "device" : "devices"} in the local pairing registry.`
            : "No active mobile device is paired in this browser.",
        to: "/settings/mobile",
        action: "Mobile pairing",
        icon: Smartphone,
      },
      {
        id: "email_web",
        label: "Email and authenticated web work",
        description:
          "Connector-first drafts and sends, with a paired-browser fallback for user-authenticated sites.",
        available:
          Boolean(email?.available && email.authenticated && email.officialOrApproved) ||
          browser.available,
        detail:
          email?.available && email.authenticated && email.officialOrApproved
            ? `${email.providerId} is authenticated through its approved ${email.route.toUpperCase()} route.`
            : browser.available
              ? "No email API is connected; the paired browser can use explicitly allowed sites after you sign in."
              : "No approved email connector or paired browser route is available. Draft previews remain local and nothing can be sent.",
        to: "/settings/browser",
        action: "Email and site permissions",
        icon: Plug,
      },
      {
        id: "models",
        label: "Model providers and local engines",
        description: "Routing, health checks and provider setup for local and cloud inference.",
        available: true,
        detail: "The model control centre is available; each provider reports its own live health.",
        to: "/ocade/models",
        action: "Model control centre",
        icon: Bot,
      },
    ]);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeCompanionAdapter(() => {
      void refresh();
    });
  }, [refresh]);

  return (
    <>
      <PageHeader
        eyebrow="Extensions"
        title="Connectors"
        description="See which structured route OCADE can actually use. A disconnected connector remains unavailable; OCADE does not silently substitute mouse and keyboard."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={checking}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-3 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} aria-hidden />
            Re-check
          </button>
        }
      />

      <div className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <GlassPanel key={row.id} className="p-4">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{row.label}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        row.available
                          ? "bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"
                          : "bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]",
                      )}
                    >
                      {row.available ? "Available" : "Setup required"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>
                  <p className="mt-2 text-xs">{row.detail}</p>
                  <Link
                    to={row.to}
                    className="mt-2 inline-flex text-xs underline underline-offset-4"
                  >
                    {row.action}
                  </Link>
                </div>
              </div>
            </GlassPanel>
          );
        })}
      </div>

      <GlassPanel className="mt-4 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4" aria-hidden /> Third-party services
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Email connector contracts and their guarded browser fallback are present, but this build
          does not bundle an OAuth provider or store credentials. Calendar, storage, banking and
          workspace OAuth connectors remain unimplemented. A connector is shown as available only
          after its own runtime health and authentication checks pass.
        </p>
      </GlassPanel>
    </>
  );
}
