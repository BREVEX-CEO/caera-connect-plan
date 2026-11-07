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

/**
 * Sessions open with a single-use ephemeral token (Google's documented Live API flow), never with
 * the key: staging refused every key passed as `?key=` on the socket ("API key not valid") and the
 * Edge runtime's WebSocket cannot send headers, while minting the token over REST with the key
 * in the `x-goog-api-key` header works like every other call.
 */
const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
const LIVE_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

function mintToken(key: string, signal: AbortSignal): Promise<Response> {
  const now = Date.now();
  return fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 10 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
    }),
    redirect: "error",
    signal,
  });
}

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
type LiveInput = {
  key: string;
  model: string;
  body: Json;
  signal: AbortSignal;
  /** Injected in tests; the platform WebSocket otherwise. */
  connect?: (url: string) => LiveSocket;
  /** Injected in tests; mints the session's single-use token otherwise. */
  mint?: (key: string, signal: AbortSignal) => Promise<Response>;
};

export async function liveTurn(input: LiveInput): Promise<Response> {
  const minted = await (input.mint ?? mintToken)(input.key, input.signal);
  // The provider's own refusal (bad key, quota, outage) goes back as the handler reads any other.
  if (!minted.ok) return minted;
  const token = ((await minted.json().catch(() => null)) as { name?: unknown } | null)?.name;
  if (typeof token !== "string" || !token) return new Response(null, { status: 503 });
  return openTurn(input, `${LIVE_ENDPOINT}?access_token=${encodeURIComponent(token)}`);
}

function openTurn(input: LiveInput, url: string): Promise<Response> {
  const connect =
    input.connect ?? ((address: string) => new WebSocket(address) as unknown as LiveSocket);
  return new Promise<Response>((resolve, reject) => {
    let socket: LiveSocket;
    try {
      socket = connect(url);
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
    /*
     * Calls are asynchronous and can arrive after `turnComplete`; only `interactionStatus: IDLE`
     * means the model is done (Google, Live API docs). So the turn settles 1.5 s after the last
     * call, at IDLE, or 15 s after a turn that completed without any call.
     */
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const settleAfter = (ms: number) => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => finish(), ms);
    };
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
      clearTimeout(settleTimer);
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
          settleAfter(1_500);
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
        if (content.interactionStatus === "IDLE") return finish();
        if (content.turnComplete === true) settleAfter(sawCall ? 1_500 : 15_000);
      }
      if (message.goAway !== undefined) finish(new Error("Live session ended by the provider."));
    });
  });
}
