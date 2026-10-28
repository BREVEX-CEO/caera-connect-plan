import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ONLINE_MODEL, HIGH_ONLINE_MODEL } from "../online-models";
import { highIncluded } from "../../../../supabase/functions/_shared/workers-ai";

const SOURCE = readFileSync(
  new URL("../../../../supabase/functions/_shared/boundary.ts", import.meta.url),
  "utf8",
);
const ACCOUNT = "a".repeat(32);
const INFERENCE = "fixture-inference";
const BILLING = "fixture-billing";
const ENV = {
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
  CLOUDFLARE_WORKERS_AI_TOKEN: INFERENCE,
  CLOUDFLARE_BILLING_READ_TOKEN: BILLING,
};

type Boundary = {
  highAvailable(signal: AbortSignal): Promise<boolean>;
  callProvider(input: {
    model: string;
    body: unknown;
    signal: AbortSignal;
    slot: "primary";
  }): Promise<Response>;
};

function section(start: string, end: string): string {
  const from = SOURCE.indexOf(start);
  const to = SOURCE.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error("Boundary extraction contract changed");
  return SOURCE.slice(from, to);
}

/**
 * Execute the boundary's own untyped declarations/methods without loading Deno's
 * npm imports. The real eligibility parser runs against a fixture HTTP transport;
 * neither billing nor inference can make an external request.
 */
function fixture(
  environment: Record<string, string> = ENV,
  options: { status?: number; price?: number; inferenceCanReadBilling?: boolean } = {},
) {
  const billing = vi.fn<typeof fetch>(async (_url, init) => {
    init?.signal?.throwIfAborted();
    const authorization = new Headers(init?.headers).get("Authorization");
    const allowed =
      authorization === "Bearer " + BILLING ||
      (options.inferenceCanReadBilling && authorization === "Bearer " + INFERENCE);
    return Response.json(
      {
        success: true,
        result: [
          {
            rate_plan: { public_name: "Workers Free", scope: "account" },
            price: options.price ?? 0,
            state: "Provisioned",
            component_values: [],
          },
        ],
      },
      { status: allowed ? (options.status ?? 200) : 403 },
    );
  });
  const provider = vi.fn<typeof fetch>(async () => new Response("fixture-provider"));
  const included = vi.fn((account: string, token: string, signal: AbortSignal) =>
    highIncluded(account, token, signal, billing),
  );
  const declarations = SOURCE.match(/^const CF_\w+ = .*;$/gm)?.join("\n");
  if (!declarations) throw new Error("Boundary credentials were not discovered");
  const factory = new Function(
    "Deno",
    "highIncluded",
    "fetch",
    "HIGH_ONLINE_MODEL",
    "DEFAULT_ONLINE_MODEL",
    "PROVIDER_KEYS",
    [
      declarations,
      "return {",
      section("  highAvailable:", "\n  observe,"),
      section("  async callProvider(", "\n};"),
      "};",
    ].join("\n"),
  );
  const boundary = factory(
    { env: { get: (name: string) => environment[name] } },
    included,
    provider,
    HIGH_ONLINE_MODEL,
    DEFAULT_ONLINE_MODEL,
    { primary: "fixture-standard" },
  ) as Boundary;
  const signal = new AbortController().signal;
  const body = { messages: [{ role: "user", content: "fixture" }] };
  const dispatch = (model: string = HIGH_ONLINE_MODEL) =>
    boundary.callProvider({ model, body, signal, slot: "primary" });
  return { boundary, billing, provider, included, signal, body, dispatch };
}

describe("High boundary credential isolation", () => {
  it("checks availability with the dedicated billing credential and no inference", async () => {
    const f = fixture();
    expect(await f.boundary.highAvailable(f.signal)).toBe(true);
    expect(f.included).toHaveBeenCalledExactlyOnceWith(ACCOUNT, BILLING, f.signal);
    expect(new Headers(f.billing.mock.calls[0]![1]?.headers).get("Authorization")).toBe(
      "Bearer " + BILLING,
    );
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("rechecks billing before dispatch and sends only the inference credential", async () => {
    const f = fixture();
    expect((await f.dispatch()).status).toBe(200);
    expect(f.included).toHaveBeenCalledExactlyOnceWith(ACCOUNT, BILLING, f.signal);
    expect(f.provider).toHaveBeenCalledTimes(1);
    const [url, init] = f.provider.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT + "/ai/v1/chat/completions",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer " + INFERENCE);
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify(f.body),
      signal: f.signal,
      redirect: "error",
    });
    expect(JSON.stringify(init)).not.toContain(BILLING);
  });

  it.each([403, 500])("refuses billing HTTP %s without dispatch or fallback", async (status) => {
    const f = fixture(ENV, { status });
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).toHaveBeenCalledTimes(2);
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("never substitutes an inference token that can also read billing", async () => {
    const f = fixture(
      { ...ENV, CLOUDFLARE_BILLING_READ_TOKEN: "" },
      { inferenceCanReadBilling: true },
    );
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).not.toHaveBeenCalled();
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("requires the inference token even when billing is eligible", async () => {
    const f = fixture({ ...ENV, CLOUDFLARE_WORKERS_AI_TOKEN: "" });
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).not.toHaveBeenCalled();
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("refuses when both credentials are absent", async () => {
    const f = fixture({
      ...ENV,
      CLOUDFLARE_WORKERS_AI_TOKEN: "",
      CLOUDFLARE_BILLING_READ_TOKEN: "",
    });
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).not.toHaveBeenCalled();
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("does not dispatch on a paid subscription", async () => {
    const f = fixture(ENV, { price: 5 });
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("rechecks a permission revoked after availability", async () => {
    const f = fixture();
    expect(await f.boundary.highAvailable(f.signal)).toBe(true);
    f.billing.mockImplementationOnce(async () => new Response(null, { status: 403 }));
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).toHaveBeenCalledTimes(2);
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("propagates cancellation to billing and sends no inference", async () => {
    const f = fixture();
    const stop = new AbortController();
    stop.abort(new Error("fixture-stop"));
    expect(await f.boundary.highAvailable(stop.signal)).toBe(false);
    expect(
      (
        await f.boundary.callProvider({
          model: HIGH_ONLINE_MODEL,
          body: f.body,
          signal: stop.signal,
          slot: "primary",
        })
      ).status,
    ).toBe(412);
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("refuses invalid account configuration before any HTTP request", async () => {
    const f = fixture({ ...ENV, CLOUDFLARE_ACCOUNT_ID: "" });
    expect(await f.boundary.highAvailable(f.signal)).toBe(false);
    expect((await f.dispatch()).status).toBe(412);
    expect(f.billing).not.toHaveBeenCalled();
    expect(f.provider).not.toHaveBeenCalled();
  });

  it("keeps Standard routing independent of the billing credential", async () => {
    const f = fixture({ ...ENV, CLOUDFLARE_BILLING_READ_TOKEN: "" });
    expect((await f.dispatch(DEFAULT_ONLINE_MODEL)).status).toBe(200);
    expect(f.included).not.toHaveBeenCalled();
    expect(f.billing).not.toHaveBeenCalled();
    expect(new Headers(f.provider.mock.calls[0]![1]?.headers).get("x-goog-api-key")).toBe(
      "fixture-standard",
    );
  });

  it("rejects an unknown model without either transport", async () => {
    const f = fixture();
    expect((await f.dispatch("unknown-model")).status).toBe(400);
    expect(f.billing).not.toHaveBeenCalled();
    expect(f.provider).not.toHaveBeenCalled();
  });
});
