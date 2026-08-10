import {
  discoverLocalModels,
  streamLocalChat,
  preloadLocalModel,
  planContextWindow,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalModelInfo,
} from "../../ocade-local";
import { routeTask, PerfLedger } from "../../local/router-policy";
import type { RoutePolicy } from "../../local/router-policy";
import { detectPlatform, selectFixedModel } from "../../local/fixed-model";
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

    /*
     * ONE MODEL. `routeTask` used to choose here, from RAM, GPU presence and a
     * measured-latency ledger — and on this machine it chose a Qwen3 build
     * whose `/no_think` control token leaked into a tool argument and became a
     * YouTube search for "/no_think". Selection is not a feature; it is four
     * ways for the product to behave differently on Tuesday.
     */
    const fixed = selectFixedModel({
      platform: detectPlatform(),
      installed: discovery.models.map((m) => ({
        id: m.id,
        vision: m.vision,
        sizeBytes: m.sizeBytes,
        isCloudPointer: m.isCloudPointer,
      })),
    });
    if (!fixed.ok || !fixed.modelId) {
      return unavailable(
        "no_model",
        fixed.reason ?? "OCADE's engine is not installed on this computer yet.",
        ["download_model"],
      );
    }

    const chosen = discovery.models.find((m) => m.id === fixed.modelId) ?? null;
    this.lastChoice = chosen;
    const stats = this.ledger.stats(fixed.modelId, "general");
    const visionModel = discovery.models.find((m) => m.vision) ?? null;

    return {
      available: true,
      label: chosen?.label ?? "OCADE Local",
      locality: "on_device",
      modelId: fixed.modelId,
      measuredFirstTokenMs: stats ? Math.round(stats.medianFirstTokenMs) : null,
      capabilities: {
        text: true,
        vision: visionModel !== null,
        imageGeneration: false,
        tools: true,
      },
    };
  }

  /**
   * Warm the weights while the user is still typing.
   *
   * `pending` is whatever is already staged for the next message — attachments
   * and the conversation so far. It is used to warm at THE SAME context window
   * the send will ask for, because the runtime reloads the weights when that
   * window changes: warming at the default and then sending a long document
   * pays the whole multi-gigabyte load again, after the send rather than
   * before it, which is precisely when the optimisation was supposed to help.
   */
  async preload(pending?: BrainMessage[]): Promise<void> {
    const id = this.lastChoice?.id;
    if (!id) return;
    const plan = pending?.length
      ? planContextWindow(
          pending.map((message) => ({
            role: message.role as "system" | "user" | "assistant",
            content: message.content,
            ...(message.images?.length ? { images: message.images } : {}),
          })),
          this.policy().totalRamBytes,
        )
      : null;
    await preloadLocalModel(this.bridgeUrl, id, undefined, plan?.numCtx ?? null);
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

    // Same one model, and the same single exception: an image needs a model
    // that can read images, which is a capability requirement rather than a
    // preference. `selectFixedModel` owns that branch.
    const fixed = selectFixedModel({
      platform: detectPlatform(),
      installed: discovery.models.map((m) => ({
        id: m.id,
        vision: m.vision,
        sizeBytes: m.sizeBytes,
        isCloudPointer: m.isCloudPointer,
      })),
      visionRequired: needsVision,
    });
    const route =
      fixed.ok && fixed.modelId
        ? {
            ok: true as const,
            model: discovery.models.find((m) => m.id === fixed.modelId) ?? {
              id: fixed.modelId,
              label: "OCADE Local",
            },
            receipt: { refusal: undefined as string | undefined },
          }
        : { ok: false as const, model: null, receipt: { refusal: fixed.reason } };
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
        // The measured total, so the context window is sized to this machine
        // rather than to the smallest ceiling. Omitted when the device could
        // not be measured, which deliberately keeps the smallest ceiling.
        ...(this.policy().totalRamBytes ? { totalRamBytes: this.policy().totalRamBytes } : {}),
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
