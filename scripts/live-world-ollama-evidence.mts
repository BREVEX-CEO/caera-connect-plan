import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  streamLocalToolTurn,
  type LocalToolChatMessage,
  type LocalToolDefinition,
} from "../src/lib/ocade-local";

const bridgeUrl = process.env.OCADE_OLLAMA_URL ?? "http://127.0.0.1:11434";
const modelId = process.env.OCADE_OLLAMA_MODEL ?? "qwen3:8b";
const output = resolve("release/OCADE_LIVE_WORLD_OLLAMA_EVIDENCE.json");
const started = performance.now();
const timeline: Array<{ stage: string; atMs: number; detail?: string }> = [];
const mark = (stage: string, detail?: string) =>
  timeline.push({
    stage,
    atMs: Number((performance.now() - started).toFixed(3)),
    ...(detail ? { detail } : {}),
  });
const tools: LocalToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "world.screen.read",
      description:
        "Read the current permitted screen state. Always use this before answering what is visible.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];
const messages: LocalToolChatMessage[] = [
  {
    role: "system",
    content:
      "You are OCADE's tool planner. Use the supplied typed tool before answering. Do not invent screen state.",
  },
  { role: "user", content: "Tell me what is on the current screen." },
];
const handlers = {
  think: false,
  onTransportChunk: ({ bytes, receivedAtMs }: { bytes: number; receivedAtMs: number }) =>
    mark("ollama.socket", `${bytes} bytes at ${receivedAtMs.toFixed(3)}`),
  onNdjsonMessage: ({ done }: { done: boolean }) =>
    mark("ndjson.parser", done ? "done" : "message"),
  onDeliveryYield: ({ deliveredMessages }: { deliveredMessages: number }) =>
    mark("react.delivery-yield", `${deliveredMessages} NDJSON messages delivered`),
  onToken: (chunk: string) => mark("reasoning.service", `${chunk.length} visible characters`),
  onToolCall: (call: { function: { name: string } }) => mark("tool.loop", call.function.name),
};

mark("ollama.request", "tool selection turn");
const first = await streamLocalToolTurn(bridgeUrl, modelId, messages, tools, handlers);
if (
  !first.ok ||
  first.toolCalls.length !== 1 ||
  first.toolCalls[0].function.name !== "world.screen.read"
) {
  throw new Error(
    `The local model did not select the typed screen tool: ${first.reason ?? JSON.stringify(first.toolCalls)}`,
  );
}
messages.push(first.assistantMessage!);
messages.push({
  role: "tool",
  tool_name: "world.screen.read",
  content: JSON.stringify({
    result: {
      status: "success",
      verified: true,
      evidence: "Fresh structural observation returned.",
    },
    updatedWorldState: {
      revision: 2,
      active: { appId: "evidence.viewer", title: "OCADE Evidence Viewer" },
      screen: { fingerprint: "evidence-screen-2", visibleText: ["Release evidence", "Continue"] },
    },
  }),
});
mark("state.event", "fresh WorldState revision 2 delivered");
mark("ollama.request", "post-tool completion turn");
const second = await streamLocalToolTurn(bridgeUrl, modelId, messages, tools, handlers);
if (
  !second.ok ||
  second.toolCalls.length !== 0 ||
  !/OCADE Evidence Viewer|Release evidence|Continue/i.test(second.content)
) {
  throw new Error(
    `The local model did not use the fresh tool result: ${second.reason ?? second.content}`,
  );
}
mark("conversation.visible", `${second.content.length} characters ready for React rendering`);

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  runtime: { bridgeUrl, modelId, endpoint: "/api/chat", streaming: true, think: false },
  assertions: {
    nativeToolCallSelected: true,
    sequentialToolResultFedBack: true,
    updatedWorldStateFedBack: true,
    finalAnswerUsedObservedState: true,
    rawShellExposed: false,
  },
  selectedTool: first.toolCalls[0],
  finalAnswer: second.content,
  timeline,
};
if (process.argv.includes("--write")) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
