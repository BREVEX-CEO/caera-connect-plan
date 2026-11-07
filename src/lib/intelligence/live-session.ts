/**
 * ONE PLANNING TURN OVER A LIVE (BIDIRECTIONAL) SESSION, ANSWERED AS A STREAMED REQUEST WOULD BE.
 *
 * Some provider models are served only as live sessions (their model metadata lists
 * `bidiGenerateContent` and no `generateContent`). OCADE reads that from the provider and
 * never from a model's name. This adapter turns one OCADE turn into one short session:
 * setup, the turn's contents, then the model's function calls and the text transcript of
 * what it said. It returns the same server-sent `generateContent` chunks the edge handler
 * already reads, so permits, validation, settlement and failover stay in one place.
 *
 * Provider facts it relies on (Gemini Live API docs, checked 7 Nov 2026):
 * - Native-audio live models accept only the AUDIO response modality. Text is observed through
 *   `outputAudioTranscription`; the audio itself is discarded here and never decoded or played.
 *   OCADE never claims text-only output from such a model.
 * - Thinking live models accept only asynchronous function calls (`behavior: NON_BLOCKING`).
 *   OCADE closes the session once the turn's calls arrive, so no call waits for a result here.
 * - `turnComplete` alone does not mean the model is finished; `interactionStatus: IDLE` does.
 */

export interface LiveSocket {
  binaryType: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: never) => void): void;
}

const LIVE_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** Whether a model's provider metadata says it is served only as a live session. */
export function servedAsLiveSession(methods: readonly string[]): boolean {
  return (
    methods.includes("bidiGenerateContent") &&
    !methods.includes("generateContent") &&
    !methods.includes("streamGenerateContent")
  );
}

// Provider JSON, read field by field below with explicit checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

function isRecord(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The session setup for one turn, from the `generateContent` body the handler built. */
export function liveSetup(model: string, body: Json): Record<string, unknown> {
  const config = isRecord(body.generationConfig) ? body.generationConfig : {};
  const tools = (Array.isArray(body.tools) ? body.tools : []).map((tool: Json) => {
    const declarations = tool.function_declarations ?? tool.functionDeclarations;
    if (Array.isArray(declarations))
      return {
        functionDeclarations: declarations.map((declaration: Record<string, unknown>) => ({
          ...declaration,
          behavior: "NON_BLOCKING",
        })),
      };
    return tool.google_search ? { googleSearch: {} } : tool;
  });
  const system = body.system_instruction ?? body.systemInstruction;
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        ...(typeof config.maxOutputTokens === "number"
          ? { maxOutputTokens: config.maxOutputTokens }
          : {}),
        ...(isRecord(config.thinkingConfig) ? { thinkingConfig: config.thinkingConfig } : {}),
      },
      ...(system ? { systemInstruction: system } : {}),
      ...(tools.length ? { tools } : {}),
      outputAudioTranscription: {},
    },
  };
}

/** A refusal before the session opened, as the status a streamed request would have had. */
function refusedBeforeSetup(reason: string): Response {
  const status = /RESOURCE_EXHAUSTED|quota|rate limit/i.test(reason)
    ? 429
    : /API key|API_KEY/i.test(reason)
      ? 400
      : /PERMISSION_DENIED|unauthori[sz]ed|forbidden/i.test(reason)
        ? 403
        : /INVALID_ARGUMENT|invalid|not supported|not found|unsupported/i.test(reason)
          ? 400
          : 503;
  // The reason goes into the body the handler reads (quota detail, key errors, thinking).
  return new Response(JSON.stringify({ error: { message: reason.slice(0, 2_000) } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const frame = (value: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);

/**
 * Open a session, send the turn, and resolve once the provider accepted the setup: a 200
 * whose body streams the turn, or the refusal the provider gave before any output.
 */
export function liveTurn(input: {
  key: string;
  model: string;
  body: Json;
  signal: AbortSignal;
  /**
   * Injected in tests; the platform WebSocket otherwise. The key travels in the
   * `x-goog-api-key` header (Deno's WebSocket accepts headers): staging refused every key
   * passed as `?key=` on the socket ("API key not valid") while the same keys work over REST.
   */
  connect?: (url: string) => LiveSocket;
}): Promise<Response> {
  const connect =
    input.connect ??
    ((url: string) =>
      new (WebSocket as unknown as new (url: string, options: unknown) => LiveSocket)(url, {
        headers: { "x-goog-api-key": input.key },
      }));
  return new Promise<Response>((resolve, reject) => {
    let socket: LiveSocket;
    try {
      socket = connect(LIVE_ENDPOINT);
    } catch {
      // Never rethrow the platform error: keep the failure free of any request detail.
      reject(new Error("Live session could not be opened."));
      return;
    }
    socket.binaryType = "arraybuffer";
    let open = false;
    let finished = false;
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    const calls = new Map<string, Record<string, unknown>>();
    let sawCall = false;
    let usage: Record<string, number> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
      cancel() {
        finish();
      },
    });
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      input.signal.removeEventListener("abort", aborted);
      try {
        socket.close(1000);
      } catch {
        // already closed
      }
      if (!open) return reject(error ?? new Error("Live session ended before setup."));
      if (error) return stream?.error(error);
      stream?.enqueue(
        frame({
          candidates: [
            {
              content: {
                role: "model",
                parts: [...calls.values()].map((call) => ({ functionCall: call })),
              },
              finishReason: "STOP",
            },
          ],
          ...(usage ? { usageMetadata: usage } : {}),
        }),
      );
      stream?.close();
    };
    const aborted = () => finish(new Error("Live session stopped."));
    if (input.signal.aborted) return aborted();
    input.signal.addEventListener("abort", aborted, { once: true });

    socket.addEventListener("open", () =>
      socket.send(JSON.stringify(liveSetup(input.model, input.body))),
    );
    socket.addEventListener("close", (event: { code?: number; reason?: string }) => {
      if (finished) return;
      if (!open) {
        finished = true;
        input.signal.removeEventListener("abort", aborted);
        resolve(refusedBeforeSetup(String(event.reason ?? `closed ${event.code ?? ""}`)));
        return;
      }
      finish(new Error("Live session closed before the turn completed."));
    });
    socket.addEventListener("error", () => {
      if (!open && !finished) {
        finished = true;
        input.signal.removeEventListener("abort", aborted);
        reject(new Error("Live session could not be opened."));
      }
    });
    socket.addEventListener("message", (event: { data: unknown }) => {
      if (finished) return;
      let message: Json;
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        message = JSON.parse(raw);
      } catch {
        return finish(new Error("Live session sent an unreadable message."));
      }
      if (message.setupComplete !== undefined && !open) {
        open = true;
        socket.send(
          JSON.stringify({
            clientContent: { turns: input.body.contents ?? [], turnComplete: true },
          }),
        );
        resolve(
          new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
        );
        return;
      }
      if (!open) return;
      if (isRecord(message.usageMetadata)) {
        const meta = message.usageMetadata;
        usage = {
          ...(typeof meta.promptTokenCount === "number"
            ? { promptTokenCount: meta.promptTokenCount }
            : {}),
          ...(typeof meta.responseTokenCount === "number"
            ? { candidatesTokenCount: meta.responseTokenCount }
            : {}),
        };
      }
      if (isRecord(message.toolCall) && Array.isArray(message.toolCall.functionCalls)) {
        for (const call of message.toolCall.functionCalls) {
          if (!isRecord(call) || typeof call.name !== "string") continue;
          sawCall = true;
          const id = typeof call.id === "string" ? call.id : `live-${calls.size}`;
          calls.set(id, {
            ...(typeof call.id === "string" ? { id } : {}),
            name: call.name,
            args: isRecord(call.args) ? call.args : {},
          });
        }
      }
      if (
        isRecord(message.toolCallCancellation) &&
        Array.isArray(message.toolCallCancellation.ids)
      ) {
        for (const id of message.toolCallCancellation.ids) calls.delete(String(id));
      }
      const content = isRecord(message.serverContent) ? message.serverContent : null;
      if (content) {
        // Text the model wrote (thought summaries keep their flag) and the transcript of what it
        // said. Audio parts are dropped: nothing here plays sound.
        const parts = (
          isRecord(content.modelTurn) && Array.isArray(content.modelTurn.parts)
            ? content.modelTurn.parts
            : []
        )
          .filter((part: unknown) => isRecord(part) && typeof part.text === "string")
          .map((part: Record<string, unknown>) => ({
            text: part.text,
            ...(part.thought === true ? { thought: true } : {}),
          }));
        const said = isRecord(content.outputTranscription)
          ? content.outputTranscription.text
          : undefined;
        if (typeof said === "string" && said) parts.push({ text: said });
        if (parts.length)
          stream?.enqueue(frame({ candidates: [{ content: { role: "model", parts } }] }));
        const idle = content.interactionStatus === "IDLE";
        if (
          idle ||
          (content.turnComplete === true && (sawCall || content.interactionStatus === undefined))
        )
          return finish();
      }
      if (message.goAway !== undefined) finish(new Error("Live session ended by the provider."));
    });
  });
}
