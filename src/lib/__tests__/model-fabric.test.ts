import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ModelProviderFabric,
  REQUIRED_MODEL_PROVIDER_IDS,
  createDefaultProviderManifests,
  createModelFabricBrain,
  validateProviderBaseUrl,
  type ModelRequirement,
  type ProviderManifest,
} from "../providers/model-fabric";

const openServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ url: string }> {
  const server = createServer(handler);
  openServers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("loopback fixture did not listen");
  return { url: `http://127.0.0.1:${address.port}` };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function enabledManifest(
  id: ProviderManifest["id"],
  baseUrl: string,
  over: Partial<ProviderManifest> = {},
): ProviderManifest {
  const source = createDefaultProviderManifests().find((provider) => provider.id === id);
  if (!source) throw new Error("missing fixture manifest");
  return {
    ...source,
    ...over,
    baseUrl,
    userEnabled: true,
    authentication: { ...source.authentication, ...over.authentication },
    defaultCapabilities: { ...source.defaultCapabilities, ...over.defaultCapabilities },
  };
}

const requirement = (over: Partial<ModelRequirement> = {}): ModelRequirement => ({
  contextTokens: 4_096,
  availableRamMb: 32_768,
  availableGpuMemoryMb: 16_384,
  privacy: "local_only",
  allowMetered: false,
  ...over,
});

describe("required provider manifests and configuration safety", () => {
  it("declares every required provider exactly once with complete routing metadata", () => {
    const manifests = createDefaultProviderManifests();
    expect(manifests.map((provider) => provider.id)).toEqual(REQUIRED_MODEL_PROVIDER_IDS);
    expect(new Set(manifests.map((provider) => provider.id)).size).toBe(9);
    for (const provider of manifests) {
      expect(provider.baseUrl).toMatch(/^https?:\/\//);
      expect(provider.authentication.method).toBeTruthy();
      expect(provider.discovery).toBeTruthy();
      expect(provider.chatProtocol).toBeTruthy();
      expect(provider.defaultCapabilities.contextTokens).toBeGreaterThan(0);
      expect(provider.defaultCapabilities.expectedRamMb).toBeGreaterThanOrEqual(0);
      expect(provider.defaultCapabilities.expectedGpuMemoryMb).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(provider.priority)).toBe(true);
      expect(typeof provider.userEnabled).toBe("boolean");
    }
  });

  it("refuses public plaintext, embedded credentials and insecure cloud endpoints", () => {
    expect(validateProviderBaseUrl("http://example.com:8080", "private_network")).toMatch(
      /loopback|private/i,
    );
    expect(validateProviderBaseUrl("http://user:secret@localhost:8080", "on_device")).toMatch(
      /credentials/i,
    );
    expect(validateProviderBaseUrl("http://api.openai.com", "cloud")).toMatch(/HTTPS/i);
    expect(validateProviderBaseUrl("https://api.openai.com", "cloud")).toBeNull();
  });

  it("keeps optional cloud disabled and excluded by privacy even when discovered", async () => {
    const cloud = enabledManifest("openai", "https://api.openai.com");
    const fabric = new ModelProviderFabric(
      [cloud],
      async () => new Response(JSON.stringify({ data: [{ id: "gpt-test" }] })),
      async () => "server-only-key",
    );
    await fabric.discover("openai");
    expect(fabric.route(requirement())).toHaveLength(0);
    expect(fabric.route(requirement({ privacy: "allow_cloud", allowMetered: true }))).toHaveLength(
      1,
    );
    expect(JSON.stringify(fabric.snapshots())).not.toContain("server-only-key");
  });
});

describe("discovery, capability and resource-aware routing", () => {
  it("uses deterministic unavailable fixtures without inventing models", async () => {
    const ollama = enabledManifest("ollama", "http://localhost:11434");
    const fabric = new ModelProviderFabric([ollama], async () => {
      throw new Error("fixture offline");
    });
    const snapshot = await fabric.discover("ollama");
    expect(snapshot).toMatchObject({
      health: "unhealthy",
      circuitState: "open",
      models: [],
      lastFailure: "fixture offline",
    });
    expect(fabric.route(requirement())).toEqual([]);
  });

  it("discovers Ollama and OpenAI-compatible model shapes and infers capabilities", async () => {
    const ollama = enabledManifest("ollama", "http://localhost:11434");
    const lm = enabledManifest("lm_studio", "http://localhost:1234");
    const fetcher = vi.fn(async (url: string) =>
      url.includes("11434")
        ? new Response(
            JSON.stringify({
              models: [
                {
                  name: "vision-coder:7b",
                  size: 4_000_000_000,
                  context_length: 65_536,
                },
              ],
            }),
          )
        : new Response(JSON.stringify({ data: [{ id: "tiny-chat", context_length: 8_192 }] })),
    );
    const fabric = new ModelProviderFabric([ollama, lm], fetcher);
    await fabric.discoverEnabled();
    const snapshots = fabric.snapshots();
    expect(snapshots.flatMap((provider) => provider.models)).toHaveLength(2);
    expect(snapshots[0].models[0].capabilities).toMatchObject({
      vision: true,
      coding: true,
      contextTokens: 65_536,
    });
    expect(fabric.route(requirement({ vision: true, coding: true }))[0].id).toBe("vision-coder:7b");
    expect(fabric.route(requirement({ availableRamMb: 1_000 }))).toEqual([]);
  });

  it("selects the smallest capable healthy local model before priority", async () => {
    const first = enabledManifest("lm_studio", "http://localhost:1234", {
      priority: 1,
      defaultCapabilities: {
        ...createDefaultProviderManifests()[1].defaultCapabilities,
        expectedRamMb: 8_000,
      },
    });
    const second = enabledManifest("vllm", "http://localhost:8000", {
      priority: 99,
      defaultCapabilities: {
        ...createDefaultProviderManifests()[4].defaultCapabilities,
        expectedRamMb: 2_000,
      },
    });
    const fabric = new ModelProviderFabric(
      [first, second],
      async (url) =>
        new Response(JSON.stringify({ data: [{ id: url.includes("1234") ? "large" : "small" }] })),
    );
    await fabric.discoverEnabled();
    expect(fabric.route(requirement()).map((model) => model.id)).toEqual(["small", "large"]);
  });
});

describe("real loopback HTTP failover and circuit behavior", () => {
  it("fails over across two available HTTP providers and opens the failed circuit", async () => {
    const calls: string[] = [];
    const first = await listen((request, response) => {
      calls.push(`first:${request.url}`);
      if (request.url === "/v1/models") {
        json(response, 200, { data: [{ id: "first-small" }] });
      } else {
        json(response, 503, { error: "temporarily unavailable" });
      }
    });
    const second = await listen((request, response) => {
      calls.push(`second:${request.url}`);
      if (request.url === "/v1/models") {
        json(response, 200, { data: [{ id: "second-safe" }] });
      } else {
        json(response, 200, {
          choices: [{ message: { content: "verified loopback response" } }],
        });
      }
    });
    const firstManifest = enabledManifest("lm_studio", first.url, {
      priority: 1,
      defaultCapabilities: {
        ...createDefaultProviderManifests()[1].defaultCapabilities,
        expectedRamMb: 1_000,
      },
    });
    const secondManifest = enabledManifest("vllm", second.url, {
      priority: 2,
      defaultCapabilities: {
        ...createDefaultProviderManifests()[4].defaultCapabilities,
        expectedRamMb: 2_000,
      },
    });
    const fabric = new ModelProviderFabric([firstManifest, secondManifest]);
    await fabric.discoverEnabled();
    const result = await fabric.chat({
      requirement: requirement(),
      messages: [{ role: "user", content: "health fixture" }],
      timeoutMs: 2_000,
    });
    expect(result).toMatchObject({
      ok: true,
      providerId: "vllm",
      content: "verified loopback response",
      attempts: [
        { providerId: "lm_studio", outcome: "unhealthy" },
        { providerId: "vllm", outcome: "succeeded" },
      ],
    });
    expect(calls.slice(0, 2).sort()).toEqual(["first:/v1/models", "second:/v1/models"].sort());
    expect(calls.slice(2)).toEqual(["first:/v1/chat/completions", "second:/v1/chat/completions"]);
    expect(fabric.snapshots().find((provider) => provider.id === "lm_studio")).toMatchObject({
      circuitState: "open",
      health: "unhealthy",
      consecutiveFailures: 1,
    });
  });

  it("opens rate-limit and malformed-output circuits and does not retry another model on them", async () => {
    let chatCalls = 0;
    const manifest = enabledManifest("vllm", "http://localhost:8000");
    const rateLimited = new ModelProviderFabric([manifest], async (url) => {
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "one" }, { id: "two" }] }));
      }
      chatCalls += 1;
      return new Response("limited", { status: 429, headers: { "retry-after": "10" } });
    });
    await rateLimited.discover("vllm");
    const limited = await rateLimited.chat({
      requirement: requirement(),
      messages: [{ role: "user", content: "x" }],
    });
    expect(limited).toMatchObject({
      ok: false,
      attempts: [{ outcome: "rate_limit" }],
    });
    expect(chatCalls).toBe(1);
    expect(rateLimited.snapshots()[0]).toMatchObject({
      health: "rate_limited",
      circuitState: "open",
    });

    const malformed = new ModelProviderFabric([manifest], async (url) =>
      url.endsWith("/v1/models")
        ? new Response(JSON.stringify({ data: [{ id: "one" }] }))
        : new Response("{not json"),
    );
    await malformed.discover("vllm");
    expect(
      await malformed.chat({
        requirement: requirement(),
        messages: [{ role: "user", content: "x" }],
      }),
    ).toMatchObject({ ok: false, attempts: [{ outcome: "malformed" }] });
  });

  it("enforces request deadlines and cancellation", async () => {
    const manifest = enabledManifest("vllm", "http://localhost:8000");
    const fabric = new ModelProviderFabric([manifest], async (url, init) => {
      if (url.endsWith("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "one" }] }));
      }
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      });
    });
    await fabric.discover("vllm");
    expect(
      await fabric.chat({
        requirement: requirement(),
        messages: [{ role: "user", content: "x" }],
        timeoutMs: 5,
      }),
    ).toMatchObject({ ok: false, attempts: [{ outcome: "timeout" }] });
  });
});

describe("Phase 21 Brain integration and secret boundary", () => {
  it("adapts structured model output to the Brain contract without exposing tools", async () => {
    const manifest = enabledManifest("vllm", "http://localhost:8000");
    const fabric = new ModelProviderFabric([manifest], async (url, init) => {
      if (url.endsWith("/v1/models")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "planner", capabilities: ["structured_output"] }],
          }),
        );
      }
      expect(String(init?.body)).toContain("Do not execute tools");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  taskId: "task",
                  goal: "read",
                  actions: [],
                }),
              },
            },
          ],
        }),
      );
    });
    await fabric.discover("vllm");
    const brain = createModelFabricBrain(fabric, requirement());
    await expect(brain.propose("read")).resolves.toMatchObject({ taskId: "task" });
    expect("hands" in brain).toBe(false);
  });

  it("adds a credential only to the request and never to errors or snapshots", async () => {
    const secret = "fixture-private-token-value";
    const manifest = enabledManifest("localai", "http://localhost:8080");
    const headers: string[] = [];
    const fabric = new ModelProviderFabric(
      [manifest],
      async (_url, init) => {
        headers.push(new Headers(init?.headers).get("authorization") ?? "");
        return new Response("error", { status: 503 });
      },
      async () => secret,
    );
    await fabric.discover("localai");
    expect(headers).toEqual([`Bearer ${secret}`]);
    expect(JSON.stringify(fabric.snapshots())).not.toContain(secret);
    expect(fabric.snapshots()[0].lastFailure).not.toContain(secret);
  });
});
