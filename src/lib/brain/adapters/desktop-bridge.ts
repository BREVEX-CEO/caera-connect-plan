import {
  discoverLocalModels,
  streamLocalChat,
  preloadLocalModel,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalModelInfo,
} from "../../ocade-local";
import { routeTask, PerfLedger } from "../../local/router-policy";
import type { RoutePolicy } from "../../local/router-policy";
import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";

/**
 * The desktop engine, reached through OCADE's local bridge.
 *
 * This wraps the path that already works and is already proven at runtime —
 * discovery, hardware-aware routing, streaming, cancellation. It is deliberately
 * a thin adapter rather than a reimplementation: the evidence in
 * release/OCADE_CHAT_RUNTIME_EVIDENCE.json was produced against these exact
 * functions, and rewriting them here would throw that proof away.
 *
 * ON PORT EXPOSURE. The engine is bound to loopback by the supervisor, which
 * refuses any other bind address, and no website is ever handed this URL —
 * a page on the public internet talking to a raw inference port would be an
 * unauthenticated prompt endpoint on the user's machine. Reaching this engine
 * from anywhere other than the same machine goes through the paired-desktop
 * adapter, which authenticates.
 */
export class DesktopBridgeAdapter implements BrainAdapter {
  readonly id = "desktop_bridge" as const;
  readonly displayName = "OCADE Local";

  private readonly bridgeUrl: string;
  private readonly ledger: PerfLedger;
  private readonly policy: () => RoutePolicy;
  private lastChoice: LocalModelInfo | null = null;

  constructor(options: {
    bridgeUrl?: string;
    ledger?: PerfLedger;
    /** Read lazily: the device measurement may land after construction. */
    policy: () => RoutePolicy;
  }) {
    this.bridgeUrl = options.bridgeUrl ?? DEFAULT_LOCAL_BRIDGE_URL;
    this.ledger = options.ledger ?? new PerfLedger();
    this.policy = options.policy;
  }

  async probe(): Promise<AdapterAvailability> {
    const discovery = await discoverLocalModels(this.bridgeUrl);

    if (!discovery.reachable) {
      return unavailable("not_running", "The OCADE engine is not running on this computer.", [
        "start_engine",
      ]);
    }
    if (discovery.models.length === 0) {
      return unavailable("no_model", "The OCADE engine is running but no model is installed yet.", [
        "download_model",
      ]);
    }

    const route = routeTask("general", discovery.models, this.ledger, this.policy());
    if (!route.ok) {
      return unavailable(
        "insufficient_memory",
        route.receipt.refusal ?? "No installed model can run on this computer.",
        ["download_model"],
      );
    }

    this.lastChoice = route.model;
    const stats = this.ledger.stats(route.model.id, "general");
    const visionModel = discovery.models.find((m) => m.vision) ?? null;

    return {
      available: true,
      label: route.model.label,
      locality: "on_device",
      modelId: route.model.id,
      measuredFirstTokenMs: stats ? Math.round(stats.medianFirstTokenMs) : null,
      capabilities: {
        text: true,
        vision: visionModel !== null,
        imageGeneration: false,
        tools: true,
      },
    };
  }

  /** Warm the weights while the user is still typing. */
  async preload(): Promise<void> {
    const id = this.lastChoice?.id;
    if (!id) return;
    await preloadLocalModel(this.bridgeUrl, id);
  }

  async stream(
    messages: BrainMessage[],
    handlers: BrainStreamHandlers,
  ): Promise<BrainStreamResult> {
    const needsVision = messages.some((m) => (m.images?.length ?? 0) > 0);

    const discovery = await discoverLocalModels(this.bridgeUrl);
    if (!discovery.ok) {
      return {
        ok: false,
        failure: "unavailable",
        reason: discovery.reason ?? "The OCADE engine is not available.",
      };
    }

    const route = routeTask(
      needsVision ? "vision" : "general",
      discovery.models,
      this.ledger,
      this.policy(),
    );
    if (!route.ok) {
      return {
        ok: false,
        failure: "unavailable",
        reason:
          route.receipt.refusal ??
          (needsVision
            ? "No image-reading engine is installed on this computer."
            : "No installed engine can serve this request."),
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;

    const result = await streamLocalChat(
      this.bridgeUrl,
      route.model.id,
      messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.images?.length ? { images: m.images } : {}),
      })),
      {
        signal: handlers.signal,
        think: handlers.think,
        onToken: (chunk) => {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
          handlers.onToken(chunk);
        },
      },
    );

    // A cancellation is the user's decision, not the model failing, so it is
    // never recorded against the model's success rate.
    if (result.reason !== "cancelled") {
      this.ledger.record({
        modelId: route.model.id,
        task: needsVision ? "vision" : "general",
        firstTokenMs: firstTokenMs ?? Date.now() - startedAt,
        totalMs: Date.now() - startedAt,
        ok: result.ok,
      });
    }

    if (result.ok) return { ok: true, modelId: route.model.id, firstTokenMs };
    return result.reason === "cancelled"
      ? { ok: false, failure: "cancelled", reason: "Stopped." }
      : { ok: false, failure: "error", reason: result.reason ?? "The engine stopped responding." };
  }
}
