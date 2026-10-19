import { describe, expect, it, vi } from "vitest";
import { workersAiBody, workersAiResponse } from "../workers-ai";
import { sseData } from "../contract";
import { hardFreePlan, highIncluded } from "../../../../supabase/functions/_shared/workers-ai";

const frame = (delta: unknown, finish_reason: string | null = null) => ({
  choices: [{ index: 0, delta, finish_reason }],
});
const upstream = (values: unknown[]) =>
  new Response(values.map((v) => `data: ${JSON.stringify(v)}\n\n`).join("") + "data: [DONE]\n\n");
async function read(values: unknown[]) {
  const response = workersAiResponse(upstream(values), new AbortController().signal);
  const out: Record<string, unknown>[] = [];
  for await (const data of sseData(response.body!, "incomplete")) out.push(JSON.parse(data));
  return JSON.stringify(out);
}
const startCall = (id = "call1", args = '{"x":') => ({
  tool_calls: [{ index: 0, id, type: "function", function: { name: "read", arguments: args } }],
});

describe("Workers AI protocol, independently shaped OpenAI fixtures", () => {
  it("carries a JARVIS screenshot after a tool result as a new user observation", () => {
    const body = workersAiBody(
      {
        messages: [
          { role: "user", content: "screen result", toolResult: { callId: "look1", name: "look" } },
        ],
        tools: [],
        attachments: [{ name: "screen.jpg", mime: "image/jpeg", sizeBytes: 3, image: "YWJj" }],
      },
      16384,
    );
    expect(body.messages).toMatchObject([
      { role: "tool", tool_call_id: "look1", content: "screen result" },
      { role: "user", content: [{ type: "text" }, { type: "image_url" }] },
    ]);
  });
  it("keeps native history, image input and tools while discarding Google signatures and private thoughts", () => {
    const body = workersAiBody(
      {
        messages: [
          { role: "system", content: "system" },
          {
            role: "assistant",
            content: "public",
            parts: [
              { text: "secret reasoning", thought: true, signature: "opaque" },
              { text: "public", signature: "opaque2" },
              { callId: "c" },
            ],
            toolCalls: [{ id: "c", name: "read", arguments: { path: "x" }, signature: "opaque3" }],
          },
          { role: "user", content: "result", toolResult: { callId: "c", name: "read" } },
          { role: "user", content: "see image" },
        ],
        attachments: [{ name: "screen", mime: "image/png", sizeBytes: 3, image: "YWJj" }],
        tools: [{ name: "read", description: "Read", inputSchema: { type: "object" } }],
      },
      16384,
    );
    expect(body).toMatchObject({
      model: "@cf/google/gemma-4-26b-a4b-it",
      max_completion_tokens: 16384,
      chat_template_kwargs: { enable_thinking: true, clear_thinking: true },
      messages: [
        { role: "system", content: "system" },
        {
          role: "assistant",
          content: "public",
          tool_calls: [{ id: "c", function: { name: "read", arguments: '{"path":"x"}' } }],
        },
        { role: "tool", tool_call_id: "c", content: "result" },
        {
          role: "user",
          content: [
            { type: "text", text: "see image" },
            { type: "image_url", image_url: { url: "data:image/png;base64,YWJj" } },
          ],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(
      /secret reasoning|opaque|thoughtSignature|generationConfig/,
    );
  });
  it("joins fragmented arguments only after a terminal and maps usage, without emitting reasoning", async () => {
    const out = await read([
      frame({ content: "Answer", reasoning_content: "private" }),
      frame(startCall()),
      frame({ tool_calls: [{ index: 0, function: { arguments: "1}" } }] }, "tool_calls"),
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 20 } },
    ]);
    expect(out).toContain('"text":"Answer"');
    expect(out).not.toContain("private");
    expect(out).toContain('"functionCall":{"id":"call1","name":"read","args":{"x":1}}');
    expect(out).toContain('"finishReason":"STOP"');
    expect(out).toContain('"promptTokenCount":10');
  });
  it.each(["length", "content_filter"])("withholds calls when finished with %s", async (finish) => {
    const out = await read([frame(startCall("c", '{"x":1}'), finish)]);
    expect(out).not.toContain("functionCall");
    expect(out).toContain(finish === "length" ? "MAX_TOKENS" : "SAFETY");
  });
  it.each([
    [frame(startCall("c", "{}"))],
    [frame(startCall("c", "{broken"), "tool_calls")],
    [frame(startCall("c", "[]"), "tool_calls")],
    [frame({}, "stop"), frame({ content: "late" })],
    [frame({}, "unknown")],
    [frame({ tool_calls: [{ index: 33 }] }, "stop")],
    [
      frame(startCall("c", "{}")),
      frame(
        { tool_calls: [{ index: 1, id: "c", function: { name: "other", arguments: "{}" } }] },
        "tool_calls",
      ),
    ],
  ])(
    "rejects incomplete or malformed actions without releasing a function call: %j",
    async (...values) => {
      // Read each event: even failures after visible text must not have released an action.
      const response = workersAiResponse(upstream(values), new AbortController().signal);
      let output = "";
      await expect(
        (async () => {
          for await (const data of sseData(response.body!, "incomplete")) output += data;
        })(),
      ).rejects.toThrow();
      expect(output).not.toContain("functionCall");
    },
  );
  it("cancels a stalled provider when the caller stops", async () => {
    const cancel = vi.fn();
    const stop = new AbortController();
    const response = workersAiResponse(new Response(new ReadableStream({ cancel })), stop.signal);
    const reading = response.text();
    stop.abort(new Error("stopped"));
    await expect(reading).rejects.toThrow("stopped");
    expect(cancel).toHaveBeenCalled();
  });
});

const subscription = (patch: Record<string, unknown> = {}) => ({
  success: true,
  result: [
    {
      rate_plan: { public_name: "Workers Free", scope: "account" },
      price: 0,
      state: "Provisioned",
      component_values: [],
      ...patch,
    },
  ],
});
describe("included-only eligibility: synthetic billing records, live account unqualified", () => {
  it("accepts only an unambiguous provisioned zero-priced account subscription", () =>
    expect(hardFreePlan(subscription())).toBe(true));
  it.each([
    null,
    {},
    { success: true, result: [] },
    subscription({ price: 5 }),
    subscription({ state: "Trial" }),
    subscription({ state: "Paid" }),
    subscription({ component_values: [{ price: 1 }] }),
    subscription({ component_values: undefined }),
    subscription({ rate_plan: { public_name: "Workers Paid", scope: "account" } }),
    { success: true, result: [...subscription().result, ...subscription().result] },
  ])("fails closed for %j", (value) => expect(hardFreePlan(value)).toBe(false));
  it("performs no inference and refuses unreadable billing", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }));
    expect(
      await highIncluded("a".repeat(32), "fixture", new AbortController().signal, request),
    ).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toMatch(/\/subscriptions$/);
  });
  it("does not make a request with invalid configuration", async () => {
    const request = vi.fn<typeof fetch>();
    expect(
      await highIncluded("https://evil.test", "fixture", new AbortController().signal, request),
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
