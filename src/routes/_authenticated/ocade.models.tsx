import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Cpu,
  Cloud,
  HardDrive,
  Rocket,
  RefreshCcw,
  Info,
  ChevronLeft,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { recordAction } from "@/lib/actions";
import {
  OCADE_MODELS,
  OCADE_MODEL_FABRIC_PROVIDERS,
  OCADE_PROVIDERS,
  autoSelectModel,
  getOcadeProvider,
  type CostPref,
  type OcadeProviderId,
  type OcadeRoutingMode,
  type PrivacyPref,
  type SpeedPref,
} from "@/lib/ocade-models";
import {
  ModelProviderFabric,
  type ModelProviderId,
  type ProviderManifest,
} from "@/lib/providers/model-fabric";
import {
  getProviderPrefs,
  saveProviderPrefs,
  testLovableGateway,
  testOpenAIDirect,
  logProviderEvent,
  getUsageDiagnostics,
} from "@/lib/ocade-providers.functions";
import { cn } from "@/lib/utils";
import { ocadeIntro, ocadeHonestDisclosure } from "@/lib/ocade-identity";
import { LocalModelLifecyclePanel } from "@/components/ocade/LocalModelLifecyclePanel";
import { LocalEngineControl } from "@/components/ocade/LocalEngineControl";

export const Route = createFileRoute("/_authenticated/ocade/models")({
  head: () => ({
    meta: [{ title: "OCADE Model Control — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: OcadeModelsPage,
});

type Prefs = {
  routing: OcadeRoutingMode;
  privacy_pref: PrivacyPref;
  cost_pref: CostPref;
  speed_pref: SpeedPref;
  vision_required: boolean;
  session_override_model: string | null;
  ollama_bridge_url: string | null;
  openai_direct_enabled: boolean;
};

type TestResult = { ok: boolean; reason: string; latencyMs: number; setupRequired?: boolean };
type Diagnostics = {
  assistantMessages: number;
  byModel: { model: string; count: number }[];
  recentEvents: Array<{
    id: string;
    event_kind: string;
    provider: string;
    model: string | null;
    ok: boolean | null;
    latency_ms: number | null;
    detail: Record<string, unknown>;
    created_at: string;
  }>;
};

function OcadeModelsPage() {
  const loadPrefs = useServerFn(getProviderPrefs);
  const savePrefs = useServerFn(saveProviderPrefs);
  const testLovable = useServerFn(testLovableGateway);
  const testOpenAI = useServerFn(testOpenAIDirect);
  const logEvent = useServerFn(logProviderEvent);
  const loadDiag = useServerFn(getUsageDiagnostics);

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<OcadeProviderId | null>(null);
  const [results, setResults] = useState<Partial<Record<OcadeProviderId, TestResult>>>({});
  const [fabricResults, setFabricResults] = useState<Partial<Record<ModelProviderId, TestResult>>>(
    {},
  );
  const [fabricTesting, setFabricTesting] = useState<ModelProviderId | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  const refreshDiag = useCallback(async () => {
    try {
      const d = await loadDiag();
      setDiag(d as Diagnostics);
    } catch {
      /* ignore */
    }
  }, [loadDiag]);

  useEffect(() => {
    void (async () => {
      const p = (await loadPrefs()) as Prefs;
      setPrefs(p);
      await refreshDiag();
    })();
  }, [loadPrefs, refreshDiag]);

  const autoPreview = useMemo(() => {
    if (!prefs) return null;
    return autoSelectModel({
      privacy: prefs.privacy_pref,
      cost: prefs.cost_pref,
      speed: prefs.speed_pref,
      visionRequired: prefs.vision_required,
      sessionOverride: prefs.session_override_model,
    });
  }, [prefs]);

  const update = useCallback(
    async (patch: Partial<Prefs>, actionId: string, meta?: Record<string, unknown>) => {
      if (!prefs) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      setSaving(true);
      try {
        await savePrefs({
          data: {
            routing: patch.routing,
            privacyPref: patch.privacy_pref,
            costPref: patch.cost_pref,
            speedPref: patch.speed_pref,
            visionRequired: patch.vision_required,
            sessionOverrideModel: patch.session_override_model,
            ollamaBridgeUrl: patch.ollama_bridge_url,
            openaiDirectEnabled: patch.openai_direct_enabled,
          },
        });
        await recordAction({ actionId, metadata: meta });
      } finally {
        setSaving(false);
      }
    },
    [prefs, savePrefs],
  );

  const runTest = useCallback(
    async (id: OcadeProviderId) => {
      setTesting(id);
      try {
        let res: TestResult;
        if (id === "lovable_gateway") res = (await testLovable()) as TestResult;
        else if (id === "openai_direct") res = (await testOpenAI()) as TestResult;
        else if (id === "ollama_local")
          res = await testOllamaFromBrowser(prefs?.ollama_bridge_url, logEvent);
        else
          res = {
            ok: false,
            reason: "CAERA CADANE native model is not yet released.",
            latencyMs: 0,
            setupRequired: true,
          };
        setResults((r) => ({ ...r, [id]: res }));
        await recordAction({
          actionId: "ocade.providers.test_connection",
          metadata: { provider: id, ok: res.ok, latency_ms: res.latencyMs },
        });
        await refreshDiag();
      } finally {
        setTesting(null);
      }
    },
    [testLovable, testOpenAI, logEvent, prefs?.ollama_bridge_url, refreshDiag],
  );

  const runFabricTest = useCallback(async (provider: ProviderManifest) => {
    if (provider.privacyClass === "cloud") return;
    setFabricTesting(provider.id);
    const started = performance.now();
    try {
      const fabric = new ModelProviderFabric([{ ...provider, userEnabled: true }]);
      const snapshot = await fabric.discover(provider.id);
      const result: TestResult = {
        ok: snapshot.health === "healthy",
        reason:
          snapshot.health === "healthy"
            ? `${snapshot.displayName} responded with ${snapshot.models.length} usable model${
                snapshot.models.length === 1 ? "" : "s"
              }.`
            : (snapshot.lastFailure ?? `${snapshot.displayName} is unavailable.`),
        latencyMs: snapshot.latencyMs ?? Math.round(performance.now() - started),
      };
      setFabricResults((current) => ({ ...current, [provider.id]: result }));
      await recordAction({
        actionId: "ocade.providers.test_fabric_provider",
        metadata: {
          provider: provider.id,
          ok: result.ok,
          latency_ms: result.latencyMs,
          model_count: snapshot.models.length,
        },
      });
    } finally {
      setFabricTesting(null);
    }
  }, []);

  if (!prefs) {
    return (
      <AppShell>
        <PageHeader title="OCADE Model Control" description="Loading provider preferences…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="OCADE Model Control"
        description="Technical provider settings. Public chat always identifies as OCADE by CAERA CADANE."
        actions={
          <Link
            to="/ocade"
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" /> Back to chat
          </Link>
        }
      />

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 pb-16">
        {/* On-device engine lifecycle: install, verify, activate, remove. */}
        <GlassPanel className="p-5">
          {/*
            Start/stop comes BEFORE the lifecycle panel because it is the
            prerequisite: installing or activating a model against a runtime
            that is not listening fails for a reason the user cannot see from
            the download UI.
          */}
          <LocalEngineControl />
          <div className="mt-5" />
          <LocalModelLifecyclePanel />
        </GlassPanel>

        {/* Identity contract notice */}
        <GlassPanel className="p-5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-accent" />
            <div className="text-sm text-fg-muted">
              <p className="font-medium text-fg">Identity contract</p>
              <p className="mt-1">
                In normal conversation OCADE introduces itself as{" "}
                <span className="text-fg">{ocadeIntro()}</span> and does not casually name its
                underlying model. If a user asks directly which provider or model is answering,
                OCADE answers truthfully. Provider names remain available in diagnostics, expandable
                usage records and audit logs.
              </p>

              {/*
                Show the ACTUAL disclosure for the current selection, generated
                by the same function OCADE uses. Describing the behaviour in
                prose here would drift from what really gets said; this cannot.
              */}
              <p className="mt-2 rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs">
                <span className="text-fg">Right now OCADE would answer:</span>{" "}
                {ocadeHonestDisclosure({
                  providerId: autoPreview?.model.providerDisplay ?? null,
                  modelId: autoPreview?.model.display ?? null,
                  locality: autoPreview?.model.locality ?? null,
                })}
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Routing */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-fg">Routing</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Choose how OCADE decides which model to use. "Automatic" honours the preferences below.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["auto", ...OCADE_PROVIDERS.map((p) => p.id)] as OcadeRoutingMode[]).map((mode) => {
              const info = mode === "auto" ? null : getOcadeProvider(mode);
              const disabled = info?.status === "planned";
              const selected = prefs.routing === mode;
              return (
                <button
                  key={mode}
                  disabled={disabled}
                  onClick={() =>
                    !disabled &&
                    void update({ routing: mode }, "ocade.providers.save_prefs", { routing: mode })
                  }
                  className={cn(
                    "flex flex-col rounded-lg border p-3 text-left transition",
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-fg">
                      {mode === "auto" ? "Automatic routing" : info?.displayName}
                    </span>
                    {selected && <Check className="h-4 w-4 text-accent" />}
                  </div>
                  <span className="mt-1 text-xs text-fg-muted">
                    {mode === "auto" ? "Follow the preferences below." : info?.description}
                  </span>
                  {info?.status === "setup_required" && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--state-warning)]">
                      <AlertTriangle className="h-3 w-3" /> Setup required
                    </span>
                  )}
                  {info?.status === "planned" && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-fg-muted">
                      <Rocket className="h-3 w-3" /> Planned
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        {/* Stage 2 provider fabric */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-fg">Local model provider fabric</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Supported discovery contracts and default endpoints. Only Ollama is enabled by default;
            every other local runtime remains disabled until you intentionally start and probe it.
            Credentials are never stored in this browser-visible catalog.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-fg-muted">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Default endpoint</th>
                  <th className="py-2 pr-3">Discovery</th>
                  <th className="py-2 pr-3">Privacy / cost</th>
                  <th className="py-2 pr-3">Default state</th>
                  <th className="py-2">Probe</th>
                </tr>
              </thead>
              <tbody>
                {OCADE_MODEL_FABRIC_PROVIDERS.map((provider) => {
                  const result = fabricResults[provider.id];
                  const cloud = provider.privacyClass === "cloud";
                  return (
                    <tr key={provider.id} className="border-b border-white/5 align-top text-fg">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{provider.displayName}</div>
                        <div className="text-fg-muted">
                          {provider.authentication.method.replaceAll("_", " ")}
                        </div>
                      </td>
                      <td className="max-w-56 break-all py-3 pr-3 font-mono text-fg-muted">
                        {provider.baseUrl}
                      </td>
                      <td className="py-3 pr-3 text-fg-muted">
                        {provider.discovery.replaceAll("_", " ")}
                      </td>
                      <td className="py-3 pr-3 text-fg-muted">
                        {provider.privacyClass.replaceAll("_", " ")} /{" "}
                        {provider.costClass.replaceAll("_", " ")}
                      </td>
                      <td className="py-3 pr-3">{provider.userEnabled ? "Enabled" : "Disabled"}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={cloud || fabricTesting === provider.id}
                          title={
                            cloud
                              ? "Use the server-side OpenAI Direct connection test above."
                              : `Probe ${provider.displayName} without sending a prompt`
                          }
                          onClick={() => void runFabricTest(provider)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-fg hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RefreshCcw
                            className={cn(
                              "h-3 w-3",
                              fabricTesting === provider.id && "animate-spin",
                            )}
                          />
                          {cloud ? "Server test above" : "Probe"}
                        </button>
                        {result && (
                          <div
                            className={cn(
                              "mt-1 max-w-64",
                              result.ok
                                ? "text-[color:var(--state-success)]"
                                : "text-[color:var(--state-warning)]",
                            )}
                          >
                            {result.reason} ({result.latencyMs} ms)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            A successful probe verifies health and model discovery only. It does not claim that a
            model completed a chat, tool call, or real application task.
          </p>
        </GlassPanel>

        {/* Preferences */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-fg">Preferences</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PrefSelect
              label="Privacy"
              value={prefs.privacy_pref}
              options={[
                { v: "local_first", l: "Local-first (prefer on-device)" },
                { v: "balanced", l: "Balanced" },
                { v: "cloud_ok", l: "Cloud OK" },
              ]}
              onChange={(v) =>
                update({ privacy_pref: v as PrivacyPref }, "ocade.providers.save_prefs", {
                  privacy_pref: v,
                })
              }
            />
            <PrefSelect
              label="Cost"
              value={prefs.cost_pref}
              options={[
                { v: "cheapest", l: "Cheapest" },
                { v: "balanced", l: "Balanced" },
                { v: "best_quality", l: "Best quality" },
              ]}
              onChange={(v) =>
                update({ cost_pref: v as CostPref }, "ocade.providers.save_prefs", { cost_pref: v })
              }
            />
            <PrefSelect
              label="Speed"
              value={prefs.speed_pref}
              options={[
                { v: "fastest", l: "Fastest" },
                { v: "balanced", l: "Balanced" },
                { v: "best_quality", l: "Best quality" },
              ]}
              onChange={(v) =>
                update({ speed_pref: v as SpeedPref }, "ocade.providers.save_prefs", {
                  speed_pref: v,
                })
              }
            />
            <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={prefs.vision_required}
                onChange={(e) =>
                  update({ vision_required: e.target.checked }, "ocade.providers.save_prefs", {
                    vision_required: e.target.checked,
                  })
                }
              />
              Require vision (image understanding)
            </label>
            <PrefSelect
              label="Per-session model override"
              value={prefs.session_override_model ?? ""}
              options={[
                { v: "", l: "(none — use routing)" },
                ...OCADE_MODELS.map((m) => ({ v: m.id, l: `${m.display} — ${m.providerDisplay}` })),
              ]}
              onChange={(v) =>
                update({ session_override_model: v === "" ? null : v }, "ocade.model.change", {
                  model: v || null,
                })
              }
            />
          </div>

          {autoPreview && prefs.routing === "auto" && (
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-fg-muted">
              <span className="text-fg">Automatic selection preview:</span>{" "}
              {autoPreview.model.display}{" "}
              <span className="text-xs">({autoPreview.model.providerDisplay})</span>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {autoPreview.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
                {autoPreview.localFallbackNeeded && (
                  <li className="text-[color:var(--state-warning)]">
                    A local model is preferred but none is connected yet — cloud fallback shown.
                  </li>
                )}
              </ul>
            </div>
          )}
        </GlassPanel>

        {/* Providers */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-fg">Providers</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Truthful connection state. Nothing is faked — a provider only reports "reachable" after
            a real network test succeeds.
          </p>
          <div className="mt-4 space-y-3">
            {OCADE_PROVIDERS.map((p) => {
              const r = results[p.id];
              const Icon =
                p.locality === "local" ? HardDrive : p.id === "caera_native" ? Cpu : Cloud;
              return (
                <div key={p.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 text-fg-muted" />
                      <div>
                        <div className="text-sm font-medium text-fg">{p.displayName}</div>
                        <div className="text-xs text-fg-muted">{p.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => void runTest(p.id)}
                      disabled={testing === p.id || p.status === "planned"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-fg hover:bg-white/10 disabled:opacity-50"
                    >
                      <RefreshCcw className={cn("h-3 w-3", testing === p.id && "animate-spin")} />
                      Test
                    </button>
                  </div>

                  {p.id === "openai_direct" && (
                    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs">
                      <label className="flex items-center gap-2 text-fg">
                        <input
                          type="checkbox"
                          checked={prefs.openai_direct_enabled}
                          onChange={(e) =>
                            update(
                              { openai_direct_enabled: e.target.checked },
                              "ocade.providers.enable_openai_direct",
                              { enabled: e.target.checked },
                            )
                          }
                        />
                        Enable OpenAI Direct
                      </label>
                      <p className="mt-1 text-fg-muted">
                        OPENAI_API_KEY is stored server-side only and never sent to the browser.
                        OpenAI meters usage on your OpenAI account — this is not free.
                      </p>
                    </div>
                  )}

                  {p.id === "ollama_local" && (
                    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs">
                      <label className="block text-fg">Local bridge URL</label>
                      <input
                        aria-label="Local bridge URL"
                        type="url"
                        placeholder="http://localhost:11434"
                        defaultValue={prefs.ollama_bridge_url ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if ((prefs.ollama_bridge_url ?? "") !== val) {
                            void update(
                              { ollama_bridge_url: val || null },
                              "ocade.providers.set_bridge_url",
                              { has_url: !!val },
                            );
                          }
                        }}
                        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-fg"
                      />
                      <p className="mt-1 text-fg-muted">
                        Ollama runs on your machine. Without the Native Companion or a running local
                        bridge, this provider stays disconnected — no fake local generation.
                      </p>
                    </div>
                  )}

                  {r && (
                    <div
                      className={cn(
                        "mt-3 rounded-md border p-2 text-xs",
                        r.ok
                          ? "border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"
                          : "border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]",
                      )}
                    >
                      {r.ok ? "✓ " : r.setupRequired ? "Setup required — " : "✗ "}
                      {r.reason}{" "}
                      {r.latencyMs > 0 && <span className="opacity-70">({r.latencyMs} ms)</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* Models capability table */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-fg">Model capabilities</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-fg-muted">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Text</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Files</th>
                  <th className="py-2 pr-3">Voice</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2 pr-3">Speed</th>
                  <th className="py-2 pr-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {OCADE_MODELS.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 text-fg">
                    <td className="py-2 pr-3">{m.display}</td>
                    <td className="py-2 pr-3 text-fg-muted">{m.providerDisplay}</td>
                    <td className="py-2 pr-3">{m.capabilities.text ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{m.capabilities.image ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{m.capabilities.files ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{m.capabilities.voice ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">
                      {(m.capabilities.contextTokens / 1000).toFixed(0)}k
                    </td>
                    <td className="py-2 pr-3">{m.capabilities.speedTier}</td>
                    <td className="py-2 pr-3">{m.capabilities.costTier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>

        {/* Diagnostics */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Usage and diagnostics</h3>
            <button
              onClick={() => void refreshDiag()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-fg hover:bg-white/10"
            >
              <RefreshCcw className="h-3 w-3" /> Refresh
            </button>
          </div>
          {!diag ? (
            <p className="mt-2 text-sm text-fg-muted">Loading…</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-fg-muted">Assistant messages recorded</div>
                <div className="mt-1 text-2xl font-semibold text-fg">{diag.assistantMessages}</div>
                <div className="mt-3 space-y-1 text-xs">
                  {diag.byModel.length === 0 && <div className="text-fg-muted">No usage yet.</div>}
                  {diag.byModel.map((row) => (
                    <div key={row.model} className="flex justify-between">
                      <span className="text-fg-muted">{row.model}</span>
                      <span className="text-fg">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-fg-muted">Recent provider events</div>
                <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {diag.recentEvents.length === 0 && (
                    <li className="text-fg-muted">No events recorded yet.</li>
                  )}
                  {diag.recentEvents.map((e) => (
                    <li
                      key={e.id}
                      className={cn(
                        "rounded border border-white/5 bg-white/[0.02] px-2 py-1",
                        e.ok === false && "border-[color:var(--state-warning)]/30",
                      )}
                    >
                      <div className="flex justify-between text-fg">
                        <span>
                          {e.event_kind} · {e.provider}
                        </span>
                        <span className="text-fg-muted">
                          {new Date(e.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {e.latency_ms != null && (
                        <div className="text-fg-muted">{e.latency_ms} ms</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </GlassPanel>

        {saving && (
          <div className="fixed bottom-4 right-4 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-fg-muted backdrop-blur">
            Saving…
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PrefSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-fg-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-fg"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

async function testOllamaFromBrowser(
  bridgeUrl: string | null | undefined,
  logEvent: (args: { data: unknown }) => Promise<unknown>,
): Promise<TestResult> {
  if (!bridgeUrl) {
    await logEvent({
      data: {
        eventKind: "connection_test",
        provider: "ollama_local",
        ok: false,
        latencyMs: 0,
        detail: { reason: "no_bridge_url" },
      },
    });
    return {
      ok: false,
      reason:
        "No local bridge URL set. Install the Native Companion or set http://localhost:11434.",
      latencyMs: 0,
      setupRequired: true,
    };
  }
  const started = performance.now();
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${bridgeUrl.replace(/\/$/, "")}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(to);
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) {
      await logEvent({
        data: {
          eventKind: "connection_test",
          provider: "ollama_local",
          ok: false,
          latencyMs,
          detail: { status: res.status },
        },
      });
      return { ok: false, reason: `HTTP ${res.status} from bridge.`, latencyMs };
    }
    const j = (await res.json()) as { models?: Array<{ name: string }> };
    const count = j.models?.length ?? 0;
    await logEvent({
      data: {
        eventKind: "connection_test",
        provider: "ollama_local",
        ok: true,
        latencyMs,
        detail: { model_count: count },
      },
    });
    return {
      ok: true,
      reason:
        count > 0
          ? `Bridge reachable. ${count} local models available.`
          : "Bridge reachable. No models pulled yet.",
      latencyMs,
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - started);
    const reason = e instanceof Error ? e.message : String(e);
    await logEvent({
      data: {
        eventKind: "connection_test",
        provider: "ollama_local",
        ok: false,
        latencyMs,
        detail: { error: reason },
      },
    });
    return { ok: false, reason: `Bridge unreachable: ${reason}`, latencyMs };
  }
}
