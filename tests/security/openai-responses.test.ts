/**
 * OpenAI Responses adapter (plan 14D.4.3): instructions, input items (messages, function calls,
 * their outputs), images as input_image, nothing stored at the provider, forced call when asked;
 * the stream releases calls only after response.completed and never after an incomplete, failed
 * or truncated answer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { responsesBody, responsesResponse } from "../../src/lib/intelligence/openai-responses.ts";
import { answerText, calledTool, toolProbe } from "../../src/lib/intelligence/byok-handler.ts";

test("the request has instructions, input items, images, store false and a forced call", () => {
  const body = responsesBody(
    {
      messages: [
        { role: "system", content: "Be careful." },
        { role: "user", content: "Total column B." },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "office_sum", arguments: { column: "B" } }],
        },
        { role: "user", content: "42", toolResult: { callId: "call_1", name: "office_sum" } },
      ],
      tools: [{ name: "office_sum", description: "Sum.", inputSchema: { type: "object" } }],
      attachments: [{ name: "shot.png", mime: "image/png", image: "AAAA" } as never],
    },
    512,
    "gpt-test",
    new Set(["forced_call"]),
  ) as Record<string, any>;
  assert.equal(body.instructions, "Be careful.");
  assert.equal(body.store, false);
  assert.equal(body.tool_choice, "required");
  assert.deepEqual(body.tools[0], {
    type: "function",
    name: "office_sum",
    description: "Sum.",
    parameters: { type: "object" },
  });
  assert.deepEqual(body.input[0], {
    role: "user",
    content: [{ type: "input_text", text: "Total column B." }],
  });
  assert.deepEqual(body.input[1], {
    type: "function_call",
    call_id: "call_1",
    name: "office_sum",
    arguments: '{"column":"B"}',
  });
  assert.deepEqual(body.input[2], {
    type: "function_call_output",
    call_id: "call_1",
    output: "42",
  });
  assert.deepEqual(body.input[3].content[0], {
    type: "input_image",
    image_url: "data:image/png;base64,AAAA",
  });
});

function stream(events: Record<string, unknown>[]): Response {
  return new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}
async function read(response: Response): Promise<any[]> {
  return (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
}

const events = [
  { type: "response.created", response: {} },
  { type: "response.reasoning_summary_text.delta", delta: "private" },
  { type: "response.output_text.delta", delta: "Summing." },
  {
    type: "response.output_item.added",
    item: {
      type: "function_call",
      id: "fc_1",
      call_id: "call_9",
      name: "office_sum",
      arguments: "",
    },
  },
  { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: '{"column"' },
  { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: ':"B"}' },
  { type: "response.output_item.done", item: {} },
  { type: "response.completed", response: { usage: { input_tokens: 9, output_tokens: 4 } } },
];

test("a completed stream yields text then the call, with usage and no reasoning", async () => {
  const out = await read(responsesResponse(stream(events), AbortSignal.timeout(5000)));
  assert.equal(JSON.stringify(out).includes("private"), false);
  assert.equal(out[0].candidates[0].content.parts[0].text, "Summing.");
  assert.deepEqual(out.at(-1).candidates[0].content.parts, [
    { functionCall: { id: "call_9", name: "office_sum", args: { column: "B" } } },
  ]);
  assert.deepEqual(out.at(-1).usageMetadata, { promptTokenCount: 9, candidatesTokenCount: 4 });
});

test("incomplete, failed or truncated answers release no call", async () => {
  const incomplete = [
    ...events.slice(0, -1),
    {
      type: "response.incomplete",
      response: { incomplete_details: { reason: "max_output_tokens" } },
    },
  ];
  const out = await read(responsesResponse(stream(incomplete), AbortSignal.timeout(5000)));
  assert.deepEqual(out.at(-1).candidates[0].content.parts, []);
  assert.equal(out.at(-1).candidates[0].finishReason, "MAX_TOKENS");
  await assert.rejects(
    read(
      responsesResponse(
        stream([...events.slice(0, -1), { type: "response.failed" }]),
        AbortSignal.timeout(5000),
      ),
    ),
  );
  await assert.rejects(
    read(responsesResponse(stream(events.slice(0, -1)), AbortSignal.timeout(5000))),
  );
});

test("the connection test speaks Responses and reads its answers", () => {
  const probe = toolProbe("responses", "gpt-test") as Record<string, any>;
  assert.equal(probe.tool_choice, "required");
  assert.equal(probe.store, false);
  assert.equal(calledTool("responses", { output: [{ type: "function_call", name: "ok" }] }), true);
  assert.equal(calledTool("responses", { output: [{ type: "message", content: [] }] }), false);
  assert.equal(calledTool("responses", { choices: [] }), null);
  assert.equal(
    answerText("responses", {
      output: [{ type: "message", content: [{ type: "output_text", text: "red blue" }] }],
    }),
    "red blue",
  );
});
