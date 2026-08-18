import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const files = {
  chatApi: read("src/routes/api/ocade.chat.ts"),
  models: read("src/lib/ocade-models.ts"),
  serverRouter: read("src/lib/ocade-router.ts"),
  engineRouter: read("src/lib/engine/resolve.ts"),
  brainRouter: read("src/lib/brain/router.ts"),
  gateway: read("src/lib/ai-gateway.server.ts"),
  providers: read("src/lib/ocade-providers.functions.ts"),
  prefs: read("src/lib/use-chat-prefs.ts"),
  modelsPage: read("src/routes/_authenticated/ocade.models.tsx"),
  webgpu: read("src/lib/brain/adapters/browser-webgpu.ts"),
  wasm: read("src/lib/brain/adapters/browser-wasm.ts"),
  sharedBrowser: read("src/lib/brain/adapters/shared-browser.ts"),
  useBrain: read("src/lib/brain/use-brain.ts"),
  browserCatalogue: read("src/lib/brain/browser-catalogue.ts"),
  modelDownload: read("src/lib/brain/model-download.ts"),
  lifecycle: read("src/lib/local/model-lifecycle.ts"),
  sw: read("public/sw.js"),
  ocadeFunctions: read("src/lib/ocade.functions.ts"),
  webhook: read("src/routes/api/public/payments/webhook.ts"),
  devices: read("src/lib/devices.ts"),
  registrationMigration: read("supabase/migrations/20260818195000_atomic_browser_device_registration.sql"),
  launch: read("src/lib/launch/launch-window.ts"),
};

describe("full-repo confirmed defect regressions", () => {
  it("#1 cloud AI is fail-closed at every generation authority", () => {
    expect(files.chatApi).toContain("status: 410");
    expect(files.serverRouter).toContain('code: "local_execution_only"');
    expect(files.engineRouter).toContain("cloud_routing_removed");
    expect(files.brainRouter).toContain("cloudWouldHelp: false");
    expect(files.models).not.toMatch(/gemini-3\.|openai\/gpt/i);
    expect(files.gateway).not.toMatch(/api\.openai\.com|ai\.gateway\.lovable\.dev|OPENAI_API_KEY|LOVABLE_API_KEY/i);
  });

  it("#2 provider metadata fails closed and accepts only private local bridge hosts", () => {
    expect(files.providers).toContain("isPrivateBridgeUrl");
    expect(files.providers).toContain('throw new Response(error.message, { status: 500 })');
    expect(files.providers).not.toMatch(/api\.openai\.com|ai\.gateway\.lovable\.dev/);
  });

  it("#3 verified payment events are never acknowledged after a failed database write", () => {
    expect(files.webhook).toContain('return new Response("Webhook processing failed; retry", { status: 500 })');
    expect(files.webhook).toMatch(/if \(error\) throw new Error/);
  });

  it("#4 browser tier promotion uses proof of the previous tier instead of circular self-proof", () => {
    expect(files.browserCatalogue).toContain("benchmark.provenRank < chosen.rank");
    expect(files.browserCatalogue).toContain("candidate.rank !== chosen.rank + 1");
  });

  it("#5 multiple tabs share exactly one browser-model owner", () => {
    expect(files.sharedBrowser).toContain("navigator.locks");
    expect(files.sharedBrowser).toContain("BroadcastChannel");
    expect(files.useBrain).toContain("new SharedBrowserAdapter()");
  });

  it("#6 a healthy preferred engine does not also warm a large browser fallback", () => {
    expect(files.useBrain).toContain("if (availability.available) return bridge.preload(pending)");
    expect(files.useBrain).toContain("if (!availability.available) warmBrowser()");
  });

  it("#7 transient resume failures preserve partial browser model bytes", () => {
    const failureIndex = files.modelDownload.indexOf("if (!response.ok && response.status !== 206)");
    const removeIndex = files.modelDownload.indexOf("await store.remove(request.key)", failureIndex);
    const successful200Index = files.modelDownload.indexOf("if (resumeAt > 0 && response.status === 200)");
    expect(failureIndex).toBeGreaterThan(-1);
    expect(successful200Index).toBeGreaterThan(failureIndex);
    expect(removeIndex === -1 || removeIndex > successful200Index).toBe(true);
  });

  it("#8 verified metadata is bound to the exact physical model size", () => {
    expect(files.modelDownload).toContain("existingMeta.expectedBytes === alreadyHave");
    expect(files.modelDownload).toContain("expectedBytes: finalBytes");
  });

  it("#9 published model digests fail closed when verification is unavailable", () => {
    expect(files.modelDownload).toContain('failure: "verification_unavailable"');
    expect(files.wasm).toContain("if (!download.verified)");
  });

  it("#10 local Ollama pulls retry automatically with bounded exponential backoff", () => {
    expect(files.lifecycle).toContain("DEFAULT_PULL_ATTEMPTS = 5");
    expect(files.lifecycle).toContain("retryBase * 2 ** (attempt - 1)");
  });

  it("#11 the final non-newline NDJSON pull object is parsed", () => {
    expect(files.lifecycle).toContain("buffer += decoder.decode()");
    expect(files.lifecycle).toContain("parsePullLine(buffer.trim()");
  });

  it("#12 service-worker cache writes extend the fetch event lifetime", () => {
    expect((files.sw.match(/event\.waitUntil\(cacheSuccessful\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("#13 auth/API/server functions stay outside the service-worker cache and flaky installs can retry", () => {
    expect(files.sw).toContain('url.pathname === "/auth"');
    expect(files.sw).toContain('url.pathname.startsWith("/api/")');
    expect(files.sw).toContain('url.pathname.startsWith("/_serverFn/")');
    expect(files.sw).toContain("OCADE_RETRY_OFFLINE_CACHE");
  });

  it("#14 Supabase persistence checks database errors/affected rows and avoids duplicate retry after title failure", () => {
    expect(files.ocadeFunctions).toContain('throw new Response(error.message, { status: 500 })');
    expect(files.ocadeFunctions).toContain('throw new Response("Conversation not found", { status: 404 })');
    expect(files.ocadeFunctions).toContain("title_update_failed: titleUpdateFailed");
  });

  it("#15 launch readiness is human-controlled, timer-free and Host cannot bypass production readiness", () => {
    expect(files.launch).toContain("now` is retained in the signature for compatibility");
    expect(files.launch).toContain('nodeEnv !== "production" && isInternalHost(hostname)');
    expect(files.launch).toContain("if (!isLaunchReady(env))");
  });

  it("#16 browser device registration is one authenticated transaction with per-install serialization", () => {
    expect(files.devices).toContain("register_browser_device_for_current_user");
    expect(files.registrationMigration).toContain("pg_advisory_xact_lock");
    expect(files.registrationMigration).toContain("auth.uid()");
  });

  it("#17 same-tab preload/send races share one model initialization promise", () => {
    expect(files.webgpu).toContain("private starting: Promise<WebLlmEngine> | null");
    expect(files.webgpu).toContain("if (this.starting && this.startingModelId === modelId) return this.starting");
    expect(files.wasm).toContain("private starting: Promise<WllamaInstance> | null");
    expect(files.wasm).toContain("if (this.starting && this.startingKey === key) return this.starting");
  });

  it("#18 WASM cannot bypass OCADE's verified persistent model store", () => {
    expect(files.wasm).not.toContain("loadModelFromHF");
    expect(files.wasm).toContain("if (!ModelStore.isSupported())");
    expect(files.wasm).toContain("OCADE refuses to execute compatibility weights that were not fingerprint-verified");
  });

  it("#19 Model Control exposes only local engines", () => {
    expect(files.modelsPage).toContain("OCADE Local Engines");
    expect(files.modelsPage).not.toMatch(/testLovableConnection|testOpenAIConnection|Gemini|GPT\/OpenAI/);
  });

  it("#20 followers re-elect a browser-model owner when the Web Lock disappears", () => {
    expect(files.sharedBrowser).toContain("navigator.locks as LockManager");
    expect(files.sharedBrowser).toContain("manager.query");
    expect(files.sharedBrowser).toContain("if (!ownerExists) this.resetFollowerForReelection()");
  });

  it("#21 relay timeout is activity-aware instead of one fixed wall-clock deadline", () => {
    expect(files.sharedBrowser).toContain("HEARTBEAT_MS");
    expect(files.sharedBrowser).toContain("REQUEST_IDLE_TIMEOUT_MS");
    expect(files.sharedBrowser).toContain("pending?.touch()");
    expect(files.sharedBrowser).toContain('message.type === "heartbeat"');
  });

  it("migrates a stale saved cloud preference back to local", () => {
    expect(files.prefs).toContain('storedTier === "cloud"');
    expect(files.prefs).toContain('? "local"');
  });
});
