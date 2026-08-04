/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/**
 * The WebGPU engine's worker.
 *
 * Inference MUST NOT run on the UI thread. A 0.5B model still occupies the
 * thread for hundreds of milliseconds at a time, and on the main thread that
 * is a frozen cursor, a stuck scroll and a chat window that cannot even render
 * the tokens it is producing. WebLLM's handler does the work here and posts
 * results back, so the page stays responsive while the model runs.
 *
 * Deliberately tiny: everything except the message pump belongs in the
 * adapter, where it can be read and tested without spawning a worker.
 */
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
