import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudOff, KeyRound, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getProviderPrefs,
  saveProviderPrefs,
  testLovableGateway,
  testOpenAIDirect,
} from "@/lib/ocade-providers.functions";
import type { ProviderRouting } from "@/lib/ocade-router";

/**
 * Online providers.
 *
 * Three things this page will not do:
 *
 * 1. **Show, echo, or accept an API key.** Keys are server secrets. The tests
 *    below return a status and a latency and nothing else — there is no field
 *    here that could leak one into a browser, a screenshot, or a support chat.
 * 2. **Report "connected" without connecting.** Each test makes a real request
 *    to the real provider and reports what came back, including the HTTP status
 *    on failure. A configured key that is rejected reads as failed, not ready.
 * 3. **Silently fall back.** Turning cloud off means requests stay on the
 *    device and are refused with a reason when the device cannot serve them.
 */

type Routing = ProviderRouting;

interface TestResult {
  ok: boolean;
  reason?: string;
  latencyMs?: number;
  setupRequired?: boolean;
}

const ROUTING_CHOICES: { value: Routing; label: string; detail: string }[] = [
  {
    value: "auto",
    label: "Automatic",
    detail: "Prefer this device; use the cloud only when the device cannot serve the request.",
  },
  {
    value: "ollama_local",
    label: "This device only",
    detail:
      "Never use a cloud provider. Requests the device cannot serve are refused with a reason.",
  },
  {
    value: "lovable_gateway",
    label: "OCADE Cloud",
    detail: "Send requests to the managed cloud engine. Counts against your cloud allowance.",
  },
  {
    value: "openai_direct",
    label: "Your own provider key",
    detail: "Use a key configured on the server as a project secret. Billed by that provider.",
  },
];

export function OnlineProvidersPanel() {
  const [routing, setRouting] = useState<Routing>("auto");
  const [openaiEnabled, setOpenaiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [testing, setTesting] = useState<null | "cloud" | "openai">(null);
  const [cloudResult, setCloudResult] = useState<TestResult | null>(null);
  const [openaiResult, setOpenaiResult] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = (await getProviderPrefs()) as {
        routing?: string;
        openai_direct_enabled?: boolean;
      } | null;
      setRouting((prefs?.routing as Routing) ?? "auto");
      setOpenaiEnabled(!!prefs?.openai_direct_enabled);
      setProblem(null);
    } catch (error) {
      // A settings page that cannot read the current setting must not render
      // defaults as though they were the user's choice.
      setProblem(
        `OCADE could not read your provider settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (patch: { routing?: Routing; openaiDirectEnabled?: boolean }) => {
      setSaving(true);
      const previousRouting = routing;
      const previousOpenai = openaiEnabled;
      if (patch.routing !== undefined) setRouting(patch.routing);
      if (patch.openaiDirectEnabled !== undefined) setOpenaiEnabled(patch.openaiDirectEnabled);
      try {
        await saveProviderPrefs({ data: patch });
        setProblem(null);
      } catch (error) {
        // Roll the control back to what is actually stored. Leaving it in the
        // new position would show a setting that is not in force.
        setRouting(previousRouting);
        setOpenaiEnabled(previousOpenai);
        setProblem(
          `That change was not saved: ${error instanceof Error ? error.message : String(error)}`,
        );
        toast.error("Provider settings were not saved.");
      } finally {
        setSaving(false);
      }
    },
    [routing, openaiEnabled],
  );

  const runCloudTest = useCallback(async () => {
    setTesting("cloud");
    try {
      setCloudResult((await testLovableGateway()) as TestResult);
    } catch (error) {
      setCloudResult({ ok: false, reason: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(null);
    }
  }, []);

  const runOpenAiTest = useCallback(async () => {
    setTesting("openai");
    try {
      setOpenaiResult((await testOpenAIDirect()) as TestResult);
    } catch (error) {
      setOpenaiResult({
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(null);
    }
  }, []);

  const keyStatus = (result: TestResult | null) => {
    if (!result) return <StatusBadge status="pending">Not tested</StatusBadge>;
    if (result.ok) return <StatusBadge status="connected">Reachable</StatusBadge>;
    if (result.setupRequired)
      return <StatusBadge status="setup_required">No key configured</StatusBadge>;
    return <StatusBadge status="failed">Failed</StatusBadge>;
  };

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Online providers"
        description="Whether OCADE may use a cloud engine at all, which one, and proof that it actually answers."
        actions={
          routing === "ollama_local" ? (
            <StatusBadge status="active">Cloud disabled</StatusBadge>
          ) : (
            <StatusBadge status="connected">Cloud permitted</StatusBadge>
          )
        }
      />

      {problem ? (
        <GlassPanel className="mb-5 border-destructive/40 p-4 text-sm text-muted-foreground">
          {problem}
        </GlassPanel>
      ) : null}

      <div className="grid gap-5 pb-16">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Where requests may go</h2>
          </div>
          <fieldset className="mt-4 grid gap-2" disabled={loading || saving}>
            <legend className="sr-only">Provider routing</legend>
            {ROUTING_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]"
              >
                <input
                  type="radio"
                  name="ocade-provider-routing"
                  className="mt-1"
                  value={choice.value}
                  checked={routing === choice.value}
                  onChange={() => void persist({ routing: choice.value })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {choice.detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your current setting…
            </p>
          ) : null}
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">OCADE Cloud</h2>
            </div>
            {keyStatus(cloudResult)}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The managed cloud engine. Its credential lives on the server and is never sent to this
            page.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runCloudTest()}
              disabled={testing !== null}
            >
              {testing === "cloud" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            {cloudResult ? (
              <span className="text-[13px] text-muted-foreground">
                {cloudResult.reason}
                {typeof cloudResult.latencyMs === "number" && cloudResult.latencyMs > 0
                  ? ` (${cloudResult.latencyMs} ms)`
                  : ""}
              </span>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Your own provider key</h2>
            </div>
            {keyStatus(openaiResult)}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Uses a key configured as a server secret. OCADE never displays, stores in the browser,
            or accepts a key typed into this page — add it in the project's secrets and test it
            here.
          </p>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="ocade-openai-enabled" className="text-sm text-foreground">
                Allow direct provider calls
              </Label>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Billed by that provider, not by your OCADE allowance.
              </p>
            </div>
            <Switch
              id="ocade-openai-enabled"
              checked={openaiEnabled}
              disabled={loading || saving}
              onCheckedChange={(v) => void persist({ openaiDirectEnabled: v })}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runOpenAiTest()}
              disabled={testing !== null}
            >
              {testing === "openai" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            {openaiResult ? (
              <span className="text-[13px] text-muted-foreground">
                {openaiResult.reason}
                {typeof openaiResult.latencyMs === "number" && openaiResult.latencyMs > 0
                  ? ` (${openaiResult.latencyMs} ms)`
                  : ""}
              </span>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">What cloud use means</h2>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
            <li>
              A cloud request sends the conversation and any attached content to that provider.
              OCADE asks before the first one in a conversation stored outside the cloud.
            </li>
            <li>
              Choosing “This device only” is enforced at the request, not just in this page: the
              server refuses to route a local-only preference to a cloud engine.
            </li>
            <li>Local answers are unlimited. Cloud answers count against your allowance.</li>
          </ul>
        </GlassPanel>
      </div>
    </>
  );
}
