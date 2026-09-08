import {
  assertIntelligencePermit,
  type IntelligenceBackend,
  type IntelligenceCapabilities,
  type IntelligenceEvent,
  type IntelligenceGenerationResult,
  type IntelligenceRequest,
  type IntelligenceStatus,
  type IntelligenceTransport,
  type NormalizedResponse,
  type OcadeIntelligence,
} from "./contract";

export interface IntelligenceRouterOptions {
  online: IntelligenceTransport;
  local: IntelligenceTransport;
  /** Consent, network and circuit eligibility. It must not perform I/O. */
  onlineEligible?: (request: IntelligenceRequest) => boolean;
}

function linkedController(signal?: AbortSignal): {
  controller: AbortController;
  detach: () => void;
} {
  const controller = new AbortController();
  if (!signal) return { controller, detach: () => undefined };
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  return { controller, detach: () => signal.removeEventListener("abort", abort) };
}

function requestWithSignal(request: IntelligenceRequest, signal: AbortSignal): IntelligenceRequest {
  return { ...request, signal };
}

function failureEvent(
  code: "cancelled" | "online_unavailable" | "local_unavailable" | "provider_failed",
  reason: string,
  retryable: boolean,
): IntelligenceEvent {
  return { type: "refusal", code, reason, retryable };
}

/**
 * The one backend-selection authority.
 *
 * Commercial permission is validated synchronously before a probe, fetch,
 * local model load or adapter call. Automatic may move from online to local
 * only when the online path produced no meaningful output, and carries the
 * same permit through that move.
 */
export function createOcadeIntelligence(options: IntelligenceRouterOptions): OcadeIntelligence {
  const active = new Map<string, AbortController>();

  async function safeProbe(transport: IntelligenceTransport, signal?: AbortSignal) {
    try {
      return await transport.probe(signal);
    } catch (error) {
      return {
        available: false,
        state: "unavailable" as const,
        reason: error instanceof Error ? error.message : String(error),
        capabilities: { text: false, tools: false, vision: false },
      };
    }
  }

  async function status(): Promise<IntelligenceStatus> {
    const [online, local] = await Promise.all([
      safeProbe(options.online),
      safeProbe(options.local),
    ]);
    return {
      automatic:
        online.available || local.available
          ? online.available
            ? "ready"
            : "degraded"
          : "unavailable",
      online: online.available ? "ready" : "unavailable",
      local: local.available ? "ready" : local.state,
    };
  }

  async function capabilities(): Promise<IntelligenceCapabilities> {
    const [online, local] = await Promise.all([
      safeProbe(options.online),
      safeProbe(options.local),
    ]);
    const available = [online, local].filter((entry) => entry.available);
    const backends: IntelligenceBackend[] = [];
    if (online.available) backends.push(options.online.backend);
    if (local.available) backends.push(options.local.backend);
    return {
      modes: ["automatic", "online", "local_only"],
      backends,
      text: available.some((entry) => entry.capabilities.text),
      tools: available.some((entry) => entry.capabilities.tools),
      vision: available.some((entry) => entry.capabilities.vision),
    };
  }

  async function* stream(request: IntelligenceRequest): AsyncIterable<IntelligenceEvent> {
    // Deliberately before linked signals or transport probes: an invalid caller
    // is allowed to cause no intelligence-side effect whatsoever.
    assertIntelligencePermit(request);
    const { controller, detach } = linkedController(request.signal);
    const prior = active.get(request.generationId);
    prior?.abort(new DOMException("Superseded", "AbortError"));
    active.set(request.generationId, controller);
    const routed = requestWithSignal(request, controller.signal);

    const run = async function* (
      transport: IntelligenceTransport,
    ): AsyncGenerator<
      IntelligenceEvent,
      { meaningful: boolean; refusal: IntelligenceEvent | null }
    > {
      const probe = await safeProbe(transport, controller.signal);
      if (!probe.available) {
        const code = transport === options.online ? "online_unavailable" : "local_unavailable";
        return {
          meaningful: false,
          refusal: failureEvent(
            code,
            probe.reason ?? "That intelligence backend is unavailable.",
            true,
          ),
        };
      }

      let meaningful = false;
      let refusal: IntelligenceEvent | null = null;
      try {
        for await (const event of transport.stream(routed)) {
          if (event.type === "token" && event.text.length > 0) meaningful = true;
          if (event.type === "tool_call" || event.type === "tool_result") meaningful = true;
          if (event.type === "final" && event.response.text.trim().length > 0) meaningful = true;
          if (event.type === "refusal") {
            refusal = event;
            if (!meaningful) continue;
          }
          yield event;
        }
      } catch (error) {
        const cancelled = controller.signal.aborted;
        refusal = failureEvent(
          cancelled
            ? "cancelled"
            : transport === options.online
              ? "provider_failed"
              : "local_unavailable",
          cancelled
            ? "Cancelled before intelligence finished."
            : error instanceof Error
              ? error.message
              : "The intelligence backend stopped unexpectedly.",
          !cancelled,
        );
      }
      return { meaningful, refusal };
    };

    try {
      if (controller.signal.aborted) {
        yield failureEvent("cancelled", "Cancelled before intelligence was asked.", false);
        return;
      }

      const onlineEligible =
        request.permit.source === "server" &&
        request.privacy.onlineInferenceConsented &&
        !request.privacy.sealed &&
        (options.onlineEligible?.(request) ?? true);

      if (request.mode === "online" && !onlineEligible) {
        yield {
          type: "refusal",
          code: "online_not_consented",
          reason: "Online intelligence is unavailable for this conversation's privacy settings.",
          retryable: false,
        };
        return;
      }

      if (request.mode === "online" || (request.mode === "automatic" && onlineEligible)) {
        const online = run(options.online);
        let step = await online.next();
        while (!step.done) {
          yield step.value;
          step = await online.next();
        }
        const outcome = step.value;
        if (outcome.meaningful) {
          if (outcome.refusal) yield outcome.refusal;
          return;
        }
        if (request.mode === "online") {
          yield outcome.refusal ??
            failureEvent("online_unavailable", "Online intelligence returned no response.", true);
          return;
        }
        if (outcome.refusal?.type === "refusal" && !outcome.refusal.retryable) {
          yield outcome.refusal;
          return;
        }
      }

      const local = run(options.local);
      let step = await local.next();
      while (!step.done) {
        yield step.value;
        step = await local.next();
      }
      const outcome = step.value;
      if (!outcome.meaningful) {
        yield outcome.refusal ??
          failureEvent("local_unavailable", "Local Intelligence returned no response.", false);
      } else if (outcome.refusal) {
        yield outcome.refusal;
      }
    } finally {
      detach();
      if (active.get(request.generationId) === controller) active.delete(request.generationId);
    }
  }

  async function generate(request: IntelligenceRequest): Promise<IntelligenceGenerationResult> {
    let text = "";
    let final: NormalizedResponse | null = null;
    let refusal: Extract<IntelligenceEvent, { type: "refusal" }> | null = null;
    for await (const event of stream(request)) {
      if (event.type === "token") text += event.text;
      if (event.type === "final") final = event.response;
      if (event.type === "refusal") refusal = event;
    }
    if (final) return { ok: true, response: final };
    return {
      ok: false,
      code: refusal?.code ?? "empty_response",
      reason: refusal?.reason ?? "Intelligence returned no response.",
      partialText: text,
    };
  }

  async function cancel(generationId: string): Promise<void> {
    active.get(generationId)?.abort(new DOMException("Stopped by the user", "AbortError"));
    await Promise.allSettled([
      Promise.resolve(options.online.cancel?.(generationId)),
      Promise.resolve(options.local.cancel?.(generationId)),
    ]);
  }

  return { status, capabilities, stream, generate, cancel };
}
