/**
 * Anthropic Messages adapter (plan 14D.4.3): the request carries system text, alternating turns,
 * tool calls and results as blocks, images as base64 blocks and a forced call when asked; the
 * response stream becomes the common stream, releasing calls only after a valid terminal and
 * message_stop, never forwarding private reasoning, and refusing a truncated or malformed stream.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { anthropicBody, anthropicResponse } from "../../src/lib/intelligence/anthropic.ts";
import { answerText, calledTool, toolProbe } from "../../src/lib/intelligence/byok-handler.ts";

/** Provider payloads are inspected field by field; the shape is the thing under test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

test("the request has system text, alternating turns, tool blocks, images and a forced call", () => {
  const body = anthropicBody(
    {
      messages: [
        { role: "system", content: "Be careful." },
        { role: "user", content: "Total column B." },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "toolu_1", name: "office_sum", arguments: { column: "B" } }],
        },
        { role: "user", content: "42", toolResult: { callId: "toolu_1", name: "office_sum" } },
      ],
      tools: [
        {
          name: "office_sum",
          description: "Sum a column.",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: { column: { type: "string" } },
          },
        },
      ],
      attachments: [{ name: "shot.png", mime: "image/png", image: "AAAA" } as never],
    },
    1024,
    "claude-test",
    new Set(["forced_call"]),
  ) as Record<string, Loose>;
  assert.equal(body.system, "Be careful.");
  assert.equal(body.stream, true);
  assert.deepEqual(body.tool_choice, { type: "any" });
  assert.deepEqual(body.tools[0].input_schema, {
    type: "object",
    properties: { column: { type: "string" } },
  });
  assert.deepEqual(
    body.messages.map((m: { role: string }) => m.role),
    ["user", "assistant", "user"],
  );
  assert.deepEqual(body.messages[1].content[0], {
    type: "tool_use",
    id: "toolu_1",
    name: "office_sum",
    input: { column: "B" },
  });
  const last = body.messages[2].content;
  assert.equal(last[0].type, "tool_result");
  assert.equal(last[0].tool_use_id, "toolu_1");
  assert.deepEqual(last[1], {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "AAAA" },
  });
  assert.equal(
    "tool_choice" in anthropicBody({ messages: [], tools: [], attachments: [] }, 10, "m"),
    false,
  );
});

function stream(events: Record<string, unknown>[], truncated = false): Response {
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(truncated ? text.slice(0, text.length - 7) : text, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function read(response: Response): Promise<unknown[]> {
  const body = await response.text();
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
}

const callEvents = [
  { type: "message_start", message: { usage: { input_tokens: 12 } } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "secret" } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Summing." } },
  { type: "content_block_stop", index: 1 },
  {
    type: "content_block_start",
    index: 2,
    content_block: { type: "tool_use", id: "toolu_9", name: "office_sum", input: {} },
  },
  {
    type: "content_block_delta",
    index: 2,
    delta: { type: "input_json_delta", partial_json: '{"col' },
  },
  {
    type: "content_block_delta",
    index: 2,
    delta: { type: "input_json_delta", partial_json: 'umn":"B"}' },
  },
  { type: "content_block_stop", index: 2 },
  { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 7 } },
  { type: "message_stop" },
];

test("a complete stream yields text, then the call with usage, and no private reasoning", async () => {
  const out = (await read(
    anthropicResponse(stream(callEvents), AbortSignal.timeout(5000)),
  )) as Loose[];
  assert.equal(JSON.stringify(out).includes("secret"), false, "reasoning never forwarded");
  assert.equal(out[0].candidates[0].content.parts[0].text, "Summing.");
  const final = out.at(-1).candidates[0];
  assert.deepEqual(final.content.parts, [
    { functionCall: { id: "toolu_9", name: "office_sum", args: { column: "B" } } },
  ]);
  assert.equal(final.finishReason, "STOP");
  assert.deepEqual(out.at(-1).usageMetadata, { promptTokenCount: 12, candidatesTokenCount: 7 });
});

test("a stream without message_stop never releases a call", async () => {
  const cut = callEvents.slice(0, -1);
  await assert.rejects(read(anthropicResponse(stream(cut), AbortSignal.timeout(5000))));
});

test("a malformed event or a mid-answer error is refused", async () => {
  await assert.rejects(
    read(anthropicResponse(stream([{ type: "surprise" }]), AbortSignal.timeout(5000))),
  );
  await assert.rejects(
    read(
      anthropicResponse(
        stream([callEvents[0]!, { type: "error", error: { type: "overloaded_error" } }]),
        AbortSignal.timeout(5000),
      ),
    ),
  );
});

test("max_tokens is reported as MAX_TOKENS and releases no call", async () => {
  const events = [
    ...callEvents.slice(0, -2),
    { type: "message_delta", delta: { stop_reason: "max_tokens" } },
    { type: "message_stop" },
  ];
  const out = (await read(anthropicResponse(stream(events), AbortSignal.timeout(5000)))) as Loose[];
  const final = out.at(-1).candidates[0];
  assert.equal(final.finishReason, "MAX_TOKENS");
  assert.deepEqual(final.content.parts, []);
});

test("the connection test speaks Messages and reads its answers", () => {
  const probe = toolProbe("anthropic", "claude-test") as Record<string, Loose>;
  assert.deepEqual(probe.tool_choice, { type: "any" });
  assert.equal(probe.tools[0].name, "ok");
  assert.equal(
    calledTool("anthropic", { content: [{ type: "tool_use", name: "ok", input: {} }] }),
    true,
  );
  assert.equal(calledTool("anthropic", { content: [{ type: "text", text: "no" }] }), false);
  assert.equal(calledTool("anthropic", { choices: [] }), null, "another protocol's answer");
  assert.equal(
    answerText("anthropic", {
      content: [
        { type: "text", text: "red " },
        { type: "text", text: "blue" },
      ],
    }),
    "red blue",
  );
});
