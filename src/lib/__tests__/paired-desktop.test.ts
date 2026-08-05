import { describe, it, expect, vi } from "vitest";
import { PairedDesktopAdapter, PAIRED_BRIDGE_CONTRACT } from "../brain/adapters/paired-desktop";
import type { PairedCredentials } from "../brain/adapters/paired-desktop";

/**
 * Borrowing a paired computer's engine.
 *
 * The assertions that matter most are about what is NOT sent: the shared
 * secret signs each request and never travels, and every request carries a
 * fresh nonce so a captured one cannot be replayed. A mistake here hands
 * someone else's machine to whoever recorded the traffic.
 */

const creds: PairedCredentials = {
  deviceId: "dev-1",
  bridgeUrl: "https://laptop.local:7443",
  secret: "shared-secret-value",
};

const source = (value: PairedCredentials | null = creds) => ({ current: () => value });

function ndjson(lines: object[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("probing a paired computer", () => {
  it("reports not paired, with a remedy, when nothing is stored", async () => {
    const adapter = new PairedDesktopAdapter({ credentials: source(null) });
    const availability = await adapter.probe();
    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.code).toBe("not_paired");
      expect(availability.remedies).toContain("pair_a_computer");
    }
  });

  it("reports the computer's own label and capabilities when it answers", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ label: "Work laptop", modelId: "qwen3:8b", vision: true, tools: true }),
    );
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const availability = await adapter.probe();
    expect(availability.available).toBe(true);
    if (availability.available) {
      expect(availability.label).toBe("Work laptop");
      // Its locality is NOT "on_device": it is the user's machine, but not this one.
      expect(availability.locality).toBe("paired_device");
      expect(availability.capabilities.vision).toBe(true);
    }
  });

  it("treats a refusal as needing re-pairing rather than as a crash", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 403 }));
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const availability = await adapter.probe();
    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.code).toBe("not_paired");
      expect(availability.remedies).toContain("pair_a_computer");
    }
  });

  it("treats an unreachable computer as ordinary, not as an error", async () => {
    // A sleeping laptop is the common case, and it should simply mean
    // "use another engine" rather than surfacing a failure.
    const fetchImpl = vi.fn(async () => {
      throw new Error("network unreachable");
    });
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const availability = await adapter.probe();
    expect(availability.available).toBe(false);
    if (!availability.available) expect(availability.code).toBe("not_running");
  });
});

describe("what goes on the wire", () => {
  it("signs every request and NEVER sends the secret", async () => {
    let captured: Record<string, string> = {};
    let body: string | null = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = (init?.headers ?? {}) as Record<string, string>;
      body = init?.body ? String(init.body) : null;
      return ndjson([{ token: "hi" }]);
    });
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await adapter.stream([{ role: "user", content: "hello" }], { onToken: () => {} });

    for (const header of PAIRED_BRIDGE_CONTRACT.headers) {
      expect(captured[header], `missing ${header}`).toBeTruthy();
    }
    // The secret signs; it does not travel.
    expect(JSON.stringify(captured)).not.toContain(creds.secret);
    expect(body ?? "").not.toContain(creds.secret);
    expect(captured["x-ocade-signature"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a fresh nonce for every request, so a captured one cannot be replayed", async () => {
    const nonces: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      nonces.push((init?.headers as Record<string, string>)["x-ocade-nonce"]);
      return ndjson([{ token: "x" }]);
    });
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await adapter.stream([{ role: "user", content: "a" }], { onToken: () => {} });
    await adapter.stream([{ role: "user", content: "a" }], { onToken: () => {} });
    expect(nonces).toHaveLength(2);
    expect(nonces[0]).not.toBe(nonces[1]);
  });
});

describe("streaming and failure", () => {
  it("delivers tokens and reports the model that produced them", async () => {
    const fetchImpl = vi.fn(async () =>
      ndjson([{ modelId: "qwen3:8b" }, { token: "To" }, { token: "kyo" }]),
    );
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    let text = "";
    const result = await adapter.stream([{ role: "user", content: "capital?" }], {
      onToken: (c) => (text += c),
    });
    expect(text).toBe("Tokyo");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.modelId).toBe("qwen3:8b");
  });

  it("survives a keep-alive or partial line without treating it as an error", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("\n"));
        controller.enqueue(encoder.encode("not json\n"));
        controller.enqueue(encoder.encode('{"token":"ok"}\n'));
        controller.close();
      },
    });
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
    });
    let text = "";
    const result = await adapter.stream([{ role: "user", content: "x" }], {
      onToken: (c) => (text += c),
    });
    expect(result.ok).toBe(true);
    expect(text).toBe("ok");
  });

  it("names a busy computer rather than reporting a generic failure", async () => {
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: (async () =>
        new Response("slow down", { status: 429 })) as unknown as typeof fetch,
    });
    const result = await adapter.stream([{ role: "user", content: "x" }], { onToken: () => {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/busy/i);
  });

  it("reports a rejected device as needing re-pairing", async () => {
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: (async () => new Response("no", { status: 401 })) as unknown as typeof fetch,
    });
    const result = await adapter.stream([{ role: "user", content: "x" }], { onToken: () => {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("unavailable");
      expect(result.reason).toMatch(/pair it again/i);
    }
  });

  it("reports cancellation as cancelled, not as an error", async () => {
    const controller = new AbortController();
    const adapter = new PairedDesktopAdapter({
      credentials: source(),
      fetchImpl: (async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }) as unknown as typeof fetch,
    });
    const result = await adapter.stream([{ role: "user", content: "x" }], {
      onToken: () => {},
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("cancelled");
  });
});
