import { useCallback, useEffect, useRef, useState } from "react";
import { useBrain } from "../brain/use-brain";
import { resolveEngine, type EngineContext } from "../engine/resolve";
import type { BrainMessage, RemedyAction } from "../brain/adapter";
import { deliberationClause, thinkingFor, type OcadeSurface } from "../local/fixed-model";

/**
 * One on-device chat engine, shared by the demo and the signed-in product.
 *
 * WHY SHARED. The demo used to answer from a hard-coded string, and every
 * sentence about it had to admit that: "no model is running and this reply is
 * canned". That is honest, and it is also a demo of nothing — a visitor learns
 * what the interface looks like and nothing about whether the product works.
 *
 * The browser engines were already real. `BrowserWebGpuAdapter` and
 * `BrowserWasmAdapter` load weights, stream tokens and need no account, because
 * they run in the visitor's own tab. Nothing about them requires signing in;
 * the demo simply never called them.
 *
 * So this hook is the whole engine surface both screens use: route, stream,
 * cancel, and report state. The demo passes `ephemeral` so nothing is written
 * to storage; that is the only difference between the two.
 *
 * THE RULE IT KEEPS: it never claims an engine is running when one is not.
 * `status` distinguishes "checking", "ready", "loading weights", "generating"
 * and "unavailable" — and unavailable carries the real reason and the remedies
 * that would fix it, not a generic apology.
 */

export type EngineStatus =
  /** Nothing asked for yet. */
  | "idle"
  /** Deciding which engine can serve this device. */
  | "checking"
  /** An engine is available and warm enough to answer. */
  | "ready"
  /** Weights are downloading or loading. First run only. */
  | "preparing"
  /** A reply is streaming. */
  | "generating"
  /** No engine can serve this device; `reason` says why. */
  | "unavailable";

export interface EngineState {
  status: EngineStatus;
  /** Capability label — "OCADE Local", never a model or vendor name. */
  label: string | null;
  /** Present when status is "unavailable". Shown verbatim. */
  reason: string | null;
  /** Actions that would make an engine available. Render as buttons. */
  remedies: RemedyAction[];
  /** 0–1 while weights load, or null when no total is known. */
  progress: number | null;
  /**
   * True when the user asked for Thinking and the engine that answered cannot
   * carry it. The screen says so; the switch is not silently ignored.
   */
  thinkingDegraded: boolean;
}

const INITIAL: EngineState = {
  status: "idle",
  label: null,
  reason: null,
  remedies: [],
  progress: null,
  thinkingDegraded: false,
};

export interface SendOptions {
  /** Conversation so far, oldest first. The new turn is already appended. */
  messages: BrainMessage[];
  onToken: (chunk: string) => void;
  /**
   * Actions the model may call, in the runtime's function-call schema.
   *
   * Control + Work passes these; Chat does not. When an adapter carries them
   * the runtime constrains the reply into a real call rather than leaving the
   * caller to find JSON in prose — which is what failed when a 3B model wrote
   * an unterminated object and the whole run ended on it.
   */
  tools?: readonly unknown[];
  onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
  /** Cancels preparation or generation from the owning logical request. */
  signal?: AbortSignal;
  /**
   * OCADE asking the engine something on its own behalf, not the user's.
   *
   * Session-memory extraction is the case this exists for, and it has two
   * hazards that a normal send does not:
   *
   *  - It must never CANCEL the user. Every ordinary send aborts whatever was
   *    in flight, which is right when a person types over their own request
   *    and catastrophic when housekeeping does it to them. A background send
   *    holds its own controller and leaves the shared one alone.
   *  - It must never SPEAK. The engine status drives visible chrome; a
   *    "Checking…" that nobody asked for reads as the product doing something
   *    to the conversation on screen, which it is not.
   *
   * A background send is still cancelled by the next ordinary one, because
   * that one aborts what it finds — and the user winning is the whole point.
   */
  background?: boolean;
}

export interface SendResult {
  ok: boolean;
  /** Why it stopped, when it did not succeed. Never a stack trace. */
  reason?: string;
  cancelled?: boolean;
}

/**
 * What the caller knows about this request beyond the device.
 *
 * Optional so the demo — which is local-only by construction and has no
 * account — can omit all of it and still get the right answer.
 */
export interface ChatEngineContext {
  /**
   * Which room this engine is answering in.
   *
   * The ONLY thing it changes is whether the model is asked to deliberate
   * before replying — `thinkingFor` in `local/fixed-model.ts` owns that
   * decision. Defaults to `chat`, because a caller that has not thought about
   * it is a chat surface, and deliberating is the safer default for an answer
   * a person will read.
   */
  surface?: OcadeSurface;
  /**
   * The user's thinking switch, from Chat settings.
   *
   * Only consulted on the `chat` surface: Control + Work never deliberates,
   * because the turn has to produce a call the loop can execute rather than a
   * description of one. Undefined means no preference expressed, and the
   * switch stays on.
   */
  thinking?: boolean;
  preference?: EngineContext["preference"];
  privacyMode?: EngineContext["privacyMode"];
  visionRequired?: boolean;
}

export function useLocalChatEngine(context: ChatEngineContext = {}): {
  state: EngineState;
  /** Probe without generating, so a screen can show readiness before a send. */
  check: () => Promise<void>;
  send: (options: SendOptions) => Promise<SendResult>;
  /** Stop the current generation. Safe to call when nothing is running. */
  stop: () => void;
  /** Load the weights now, so the first real turn is not a cold start. */
  warm: () => void;
  remedyLabel: (remedy: RemedyAction) => string;
} {
  const brain = useBrain();
  const [state, setState] = useState<EngineState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * The background request, held separately from the user's.
   *
   * Two refs rather than one because the two directions are not symmetric: a
   * background send must never cancel the person, and the person must always
   * cancel the background send. One shared ref can only express the first half.
   */
  const backgroundRef = useRef<AbortController | null>(null);
  /*
   * Guards every setState after an await. Without it, a probe that resolves
   * after the visitor has navigated away sets state on an unmounted component,
   * and in the demo that happens constantly because the session can expire
   * mid-request.
   */
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      abortRef.current?.abort();
      backgroundRef.current?.abort();
    };
  }, []);

  const apply = useCallback((next: Partial<EngineState>) => {
    if (!liveRef.current) return;
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  /*
   * Ask the brain which adapter exists, then ask the ONE authority whether
   * this request may use it. The two questions are genuinely different — the
   * adapter probe is about hardware, and `resolveEngine` is about privacy,
   * preference, entitlement and allowance — and running them in this order is
   * what stops a request being routed before privacy has had its say.
   */
  /*
   * Destructured to primitives before the dependency array sees them.
   *
   * Callers pass `{ preference: "auto", ... }` inline, which is a new object
   * every render. Depending on it directly would make `decide` — and every
   * callback built on it — unstable, and a mount effect calling `check` would
   * loop forever. That exact bug already cost one debugging session here.
   */
  const {
    preference = "auto",
    privacyMode = "private_sync",
    visionRequired: contextVision = false,
    // Destructured for the same reason as the rest: read off `context` inside
    // the callback it would be an unlisted dependency, and the switch would go
    // on working with whatever value it held when the callback was last built —
    // a toggle that only takes effect after a remount.
    surface: contextSurface = "chat",
    thinking: contextThinking,
  } = context;

  const decide = useCallback(
    async (visionRequired: boolean) => {
      const outcome = await brain.route({ visionRequired });
      const localAvailable = outcome.ok;
      const decision = resolveEngine({
        preference,
        privacyMode,
        deviceMode: brain.mode,
        localAvailable,
        localLabel: outcome.ok ? outcome.availability.label : null,
        localVision: outcome.ok ? Boolean(outcome.availability.capabilities?.vision) : false,
        visionRequired,
        online: typeof navigator === "undefined" ? true : navigator.onLine,
      });
      return { outcome, decision };
    },
    [brain, preference, privacyMode],
  );

  const check = useCallback(async () => {
    apply({ status: "checking", reason: null, remedies: [] });
    const { outcome, decision } = await decide(contextVision);
    if (!liveRef.current) return;

    if (decision.ok && decision.target?.kind === "local" && outcome.ok) {
      apply({
        status: "ready",
        label: decision.target.label,
        reason: null,
        remedies: [],
        progress: null,
      });
      return;
    }
    apply({
      status: "unavailable",
      label: null,
      // The authority's reason wins: it knows about privacy and allowance,
      // and the adapter probe only knows about hardware.
      reason: decision.reason ?? (outcome.ok ? null : outcome.reason),
      remedies:
        decision.remedies.length > 0 ? decision.remedies : outcome.ok ? [] : outcome.remedies,
      progress: null,
    });
  }, [apply, decide, contextVision]);

  const send = useCallback(
    async ({
      messages,
      onToken,
      tools,
      onToolCall,
      signal,
      background = false,
    }: SendOptions): Promise<SendResult> => {
      // Install cancellation before adapter discovery/model preparation. STOP
      // must work while the first-run engine is still being selected, not only
      // after token generation has begun.
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(signal?.reason);
      if (signal?.aborted) abortFromCaller();
      else signal?.addEventListener("abort", abortFromCaller, { once: true });
      /*
       * A background send neither claims the shared controller nor reports
       * status. See `SendOptions.background`: housekeeping must not be able to
       * cancel the person, or to narrate itself on their screen.
       */
      const report = background ? () => {} : apply;
      const claim = (next: AbortController | null) => {
        if (background) backgroundRef.current = next;
        else abortRef.current = next;
      };
      // Housekeeping always yields to the person: an ordinary send ends any
      // background work first, and a background send touches nothing of theirs.
      backgroundRef.current?.abort();
      backgroundRef.current = null;
      if (!background) abortRef.current?.abort();
      claim(controller);
      report({ status: "checking", reason: null, remedies: [] });
      let outcomeAndDecision: Awaited<ReturnType<typeof decide>>;
      try {
        outcomeAndDecision = await decide(contextVision);
      } catch (error) {
        signal?.removeEventListener("abort", abortFromCaller);
        claim(null);
        throw error;
      }
      const { outcome, decision } = outcomeAndDecision;
      if (!liveRef.current) {
        signal?.removeEventListener("abort", abortFromCaller);
        return { ok: false, cancelled: true };
      }
      if (controller.signal.aborted) {
        claim(null);
        report({ status: "ready", progress: null });
        signal?.removeEventListener("abort", abortFromCaller);
        return { ok: false, cancelled: true, reason: "Stopped by the user." };
      }

      /*
       * The authority decides, not the adapter probe. Checking privacy on the
       * probe and skipping it here is how a vault-backed conversation would
       * leak on the one call that actually sends the text.
       */
      if (!decision.ok || decision.target?.kind !== "local" || !outcome.ok) {
        const reason =
          decision.reason ?? (outcome.ok ? "No on-device engine can serve this." : outcome.reason);
        report({
          status: "unavailable",
          label: null,
          reason,
          remedies:
            decision.remedies.length > 0 ? decision.remedies : outcome.ok ? [] : outcome.remedies,
        });
        claim(null);
        signal?.removeEventListener("abort", abortFromCaller);
        return { ok: false, reason };
      }

      report({
        status: "generating",
        label: outcome.availability.label,
        reason: null,
        remedies: [],
      });

      /*
       * MAKE THE THINKING SWITCH A REAL THING ON A MODEL THAT HAS NO FLAG.
       *
       * qwen2.5 has no reasoning mode — Ollama answers `400 does not support
       * thinking` to the field — so passing `think` alone would leave the
       * toggle doing nothing at all, which is the definition of a decorative
       * control. The clause goes into the system message instead: it changes
       * the bytes of the request, it changes the answer, and the difference is
       * visible to whoever flipped the switch.
       *
       * `think` is still passed for models that do have the mode, so this is
       * an addition rather than a replacement.
       */
      /*
       * AND THE ENGINE GETS A VETO, BECAUSE IT IS THE ONLY THING THAT KNOWS
       * WHAT IT LOADED.
       *
       * `thinkingFor` decides whether the ROOM and the USER want deliberation.
       * It cannot know which tier answered. On the WebAssembly compatibility
       * tier — the processor-only fallback — deliberating multiplies the
       * tokens produced without improving the answer, which on a weak phone is
       * the difference between a slow reply and a page the user force-quits.
       *
       * So the tier's `thinkingSuitable`, declared once in the Browser Model
       * Authority and carried up through `probe()`, degrades Thinking to Fast
       * there. Openly: `thinkingDegraded` is surfaced so the screen can say the
       * switch is not in force on this engine, rather than leaving a control
       * that appears to do something and does not.
       */
      const wanted = thinkingFor(contextSurface, contextThinking);
      const engineAllows = outcome.availability.thinkingSuitable !== false;
      const deliberate = wanted && engineAllows;
      report({ thinkingDegraded: wanted && !engineAllows });
      const withDeliberation = messages.map((message, index) =>
        index === 0 && message.role === "system"
          ? { ...message, content: `${message.content}${deliberationClause(deliberate)}` }
          : message,
      );

      let sawToken = false;
      const result = await outcome.adapter
        .stream(withDeliberation, {
          signal: controller.signal,
          ...(tools?.length ? { tools } : {}),
          ...(onToolCall ? { onToolCall } : {}),
          // Chat deliberates unless the user turned it off; Control never does.
          // One authority decides, and it is asked here rather than remembered.
          think: deliberate,
          onToken: (chunk) => {
            /*
             * The first token is what turns "preparing" into a visibly working
             * product. On a cold WebGPU start there can be a minute of silence
             * while weights load, and a screen that says "generating" through all
             * of it looks broken.
             */
            if (!sawToken) {
              sawToken = true;
              report({ status: "generating" });
            }
            onToken(chunk);
          },
        })
        .finally(() => signal?.removeEventListener("abort", abortFromCaller));

      claim(null);
      if (!liveRef.current) return { ok: false, cancelled: true };

      if (result.ok) {
        report({ status: "ready", progress: null });
        return { ok: true };
      }
      if (result.failure === "cancelled") {
        // A stop the user asked for is not an error and must not be dressed as
        // one; the partial answer stays on screen.
        report({ status: "ready", progress: null });
        return { ok: false, cancelled: true, reason: result.reason };
      }
      report({
        status: "unavailable",
        reason: result.reason,
        remedies: [],
        progress: null,
      });
      return { ok: false, reason: result.reason };
    },
    // The room decides whether the model deliberates, and the switch decides
    // it within Chat. A screen that changed either must not keep streaming
    // with the previous value — which is exactly what an unlisted dependency
    // would do, silently, until the next remount.
    [apply, decide, contextVision, contextSurface, contextThinking],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    backgroundRef.current?.abort();
    backgroundRef.current = null;
    apply({ status: "ready", progress: null });
  }, [apply]);

  /**
   * Load the weights before they are needed.
   *
   * Measured on this machine: the first Control + Work turn against a cold 7B
   * took over two minutes, almost all of it loading ~4.7 GB from disk, and the
   * screen simply said "Thinking" for the duration. Warming on arrival moves
   * that cost to the moment the user is still reading the empty state.
   *
   * Fire and forget, and deliberately not awaited by anything: a failed warm-up
   * is not an error the user should ever see, it just means the first answer is
   * as slow as it used to be.
   */
  const warm = useCallback(() => {
    brain.warm();
  }, [brain]);

  return { state, check, send, stop, warm, remedyLabel: brain.remedyLabel };
}
